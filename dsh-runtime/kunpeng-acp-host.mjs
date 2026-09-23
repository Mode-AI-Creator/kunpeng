import { join } from 'node:path';
import net from 'node:net';
import z from '@deepseek-ai/schemastery';
// Official ACP handles native attachments and tool-result images.
import * as acp from '@deepseek-ai/dsh-acp';
import AttachmentLocal from '@deepseek-ai/dsh-attachment-local';

import * as mcpClient from '@deepseek-ai/dsh-mcp-client';
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection';
import TokenMeter from '@deepseek-ai/dsh-token-meter';
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic';
import ToolResultPruner from '@deepseek-ai/dsh-compaction-tool-result-pruner';
import JsonlSessionPersistence, {
  JsonlCompressionSchema,
} from '@deepseek-ai/dsh-session-persistence-jsonl';
import * as sessionCheckpointPolicy from '@deepseek-ai/dsh-session-checkpoint-policy';
import SqliteSessionQueryEngine from '@deepseek-ai/dsh-session-query-sqlite';

export const name = 'kunpeng-acp-host';

export const Config = z.intersect([
  z.object({ persona: z.string().default(''), maxParallelToolCalls: z.number().default(1) }),
  z.object({
    provider: z.string().required(),
    model: z.string().required(),
    mcp: mcpClient.Config,
    persistenceRoot: z.string().required(),
    contextWindow: z.number().default(1_000_000),
    packChunks: z.boolean().default(true),
    persistenceCompression: JsonlCompressionSchema,
  }),
]);

export async function apply(ctx, config) {
  // ACP now publishes reasoning, tools and usage itself. Only compaction
  // remains on the private observer channel; never duplicate native chunks.
  ctx.on('session/event', (_session, event) => {
    if (['compaction/start', 'compaction/summary', 'compaction/end'].includes(event.type)) {
      process.stderr.write(`__KUNPENG_DSH_EVENT__${JSON.stringify({
        sessionUpdate: 'kunpeng_compaction', phase: event.type.slice('compaction/'.length),
        failed: event.type === 'compaction/end' && event.data.error !== undefined,
      })}\n`);
    }
  });

  // The core and every
  // consumer live in one ordered effect. Mounting the spine outside this
  // effect can let Cordis settle its fiber before ACP creates a session,
  // leaving a valid-looking transport whose bridge is already disposed.
  await ctx.effect(async function* () {
    // Explicit service composition replaces the retired upstream spine-demo.
    // These are unmodified official plugins; Kunpeng owns only the tool/UI bridge.
    const core = [
      ['@deepseek-ai/cordis-plugin-timer', {}],
      ['@deepseek-ai/dsh-llm', {}],
      ['@deepseek-ai/dsh-session', {}],
      ['@deepseek-ai/dsh-session-title', { fallbackMaxWords: 5, fallbackMaxBytes: 40, maxTitleBytes: 80 }],
      ['@deepseek-ai/dsh-system-prompt', { includeRuntimeContext: false, personaPrefix: '{{kunpeng_persona}}' }],
      ['@deepseek-ai/dsh-tools', {}],
      ['@deepseek-ai/dsh-agent', {}],
      ['@deepseek-ai/dsh-llm-retry', {}],
      ['@deepseek-ai/dsh-jobs-local', {}],
      ['@deepseek-ai/dsh-invariants', {}],
      ['@deepseek-ai/dsh-session/invariant', {}],
      ['@deepseek-ai/dsh-agent/invariant', {}],
      ['@deepseek-ai/dsh-scope/invariant', {}],
      ['@deepseek-ai/dsh-agent-loop/invariant', {}],
      ['@deepseek-ai/dsh-agent-loop', { agents: [], maxParallelToolCalls: config.maxParallelToolCalls }],
    ];
    for (const [name, options] of core) {
      const module = await import(name);
      const plugin = ctx.plugin(module.default ?? module, options);
      yield plugin.dispose;
      if (name === '@deepseek-ai/dsh-system-prompt') {
        await plugin;
        const persona = ctx.inject(['systemPrompt'], (child) => {
          child.systemPrompt.variable('kunpeng_persona', () => config.persona);
        });
        await persona;
        yield persona.dispose;
      }
    }

    const projection = ctx.plugin(SessionProjectionRegistry);
    await projection;
    yield projection.dispose;

    const meter = ctx.plugin(TokenMeter);
    await meter;
    yield meter.dispose;

    const pruner = ctx.plugin(ToolResultPruner, {
      thresholdChars: 8192,
      headChars: 4096,
      tailChars: 1024,
    });
    await pruner;
    yield pruner.dispose;

    const compaction = ctx.plugin(BasicCompactionEngine);
    await compaction;
    yield compaction.dispose;

    // MCP is a sibling of the spine, so it resolves the same ToolRuntime
    // service that the official agent loop uses without mutating DSH source.
    if (config.mcp) {
      const mcp = ctx.plugin(mcpClient, config.mcp);
      await mcp;
      yield mcp.dispose;
    }

    const persistence = ctx.plugin(JsonlSessionPersistence, {
      root: config.persistenceRoot,
      packChunks: config.packChunks,
      ...(config.persistenceCompression === undefined
        ? {}
        : { compression: config.persistenceCompression }),
    });
    await persistence;
    yield persistence.dispose;

    const checkpoint = ctx.plugin(sessionCheckpointPolicy);
    await checkpoint;
    yield checkpoint.dispose;

    const query = ctx.plugin(SqliteSessionQueryEngine, {
      path: join(config.persistenceRoot, 'session-query.db'),
    });
    await query;
    yield query.dispose;

    // Durable attachment storage for official ACP and MCP image evidence.
    // （图片字节落盘为内容寻址引用，线上请求时再 base64 内联）。
    // 单图上限对齐 DeepSeek 官方视觉限制（32MiB）。
    const attachments = ctx.plugin(AttachmentLocal, {
      dshHome: process.env.DSH_HOME || join(process.env.HOME || '', '.dsh'),
      maxImageBytes: 32 * 1024 * 1024,
      maxMessageImageBytes: 64 * 1024 * 1024,
    });
    await attachments;
    yield attachments.dispose;

    const transport = ctx.plugin(acp, {
      provider: config.provider,
      model: config.model,
    });
    await transport;
    yield transport.dispose;

    // Kunpeng sidecar: loopback command channel for host-side operations the
    // ACP method surface does not expose (manual compaction today). Frontend
    // reaches it through the Rust bridge (dsh_sidecar_call) which learns the
    // port from the __KUNPENG_SIDECAR__ stderr line below.
    const sidecar = ctx.plugin({
      name: 'kunpeng-sidecar',
      inject: ['agents', 'compaction'],
      apply(sidecarCtx) {
        void sidecarCtx.effect(async function* () {
          const server = net.createServer((socket) => {
            socket.setEncoding('utf8');
            socket.setNoDelay(true);
            let buffer = '';
            socket.on('data', (chunk) => {
              buffer += chunk;
              let newline;
              while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (!line) continue;
                let message;
                try {
                  message = JSON.parse(line);
                } catch {
                  socket.write(`${JSON.stringify({ ok: false, error: 'invalid json' })}\n`);
                  continue;
                }
                void (async () => {
                  try {
                    if (message.command === 'compact') {
                      // 复刻官方 dsh-command-compact 的核心：对本进程内活跃
                      // 的 agent 执行一次手动压缩。鲲鹏的压缩进程只 resume 一
                      // 个会话，因此进程内 agent 唯一。
                      const agents = sidecarCtx.agents.list().filter(Boolean);
                      if (agents.length === 0) {
                        socket.write(`${JSON.stringify({ ok: false, error: 'no active agent to compact' })}\n`);
                        return;
                      }
                      const agent = agents[0];
                      const result = await sidecarCtx.compaction.compactNow(
                        agent,
                        AbortSignal.timeout(10 * 60 * 1000),
                        'kunpeng-sidecar',
                      );
                      socket.write(`${JSON.stringify({ ok: true, result })}\n`);
                    } else {
                      socket.write(`${JSON.stringify({ ok: false, error: `unknown command: ${String(message.command)}` })}\n`);
                    }
                  } catch (error) {
                    const text = error && typeof error.message === 'string' ? error.message : String(error);
                    socket.write(`${JSON.stringify({ ok: false, error: text })}\n`);
                  }
                })();
              }
            });
          });
          const listening = new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', () => resolve(server.address()));
          });
          const address = await listening;
          process.stderr.write(`__KUNPENG_SIDECAR__${JSON.stringify({ port: address.port })}\n`);
          yield () => new Promise((resolve) => server.close(() => resolve()));
        });
      },
    });
    await sidecar;
    yield sidecar.dispose;
  }, 'kunpeng-acp-host.composition');
}

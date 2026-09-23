/**
 * slashCommands — 聊天输入框的斜杠命令层。
 *
 * 命令由鲲鹏前端直接拦截执行，不进入模型对话（与 DSH 官方
 * dsh-commands 的语义一致：命令针对 agent/会话操作，不产生模型消息）。
 * 未识别的 /xxx 原样作为普通消息发送。
 */

export type SlashCommandId = 'compact' | 'plan' | 'goal' | 'resume' | 'help';

export interface SlashCommandMatch {
  command: SlashCommandId;
  /** 命令名之后的原始输入（含分隔空白，命令自行解析）。 */
  rawArgs: string;
}

export interface SlashCommandSpec {
  id: SlashCommandId;
  name: string;
  usage: string;
  description: string;
}

/** 帮助文本里附加的传统命令（auto/cwd/skill 等，来自 legacy 命令注册表）。 */
export interface ExtraCommandSpec {
  usage: string;
  description: string;
}

export const SLASH_COMMANDS: readonly SlashCommandSpec[] = [
  {
    id: 'compact',
    name: '/compact',
    usage: '/compact',
    description: '手动压缩本会话的 DeepSeek Harness 历史（较早记录替换为摘要，不消耗对话轮次；执行中不可用）',
  },
  {
    id: 'plan',
    name: '/plan',
    usage: '/plan [off]',
    description: '进入计划模式：agent 先探索设计、产出完整计划等你批准后再执行；/plan off 退出',
  },
  {
    id: 'goal',
    name: '/goal',
    usage: '/goal <目标描述> | /goal clear',
    description: '设置本会话的长期目标：每轮对话自动注入，agent 围绕目标推进；/goal 查看当前，/goal clear 清除',
  },
  {
    id: 'resume',
    name: '/resume',
    usage: '/resume [序号]',
    description: '把本聊天会话重新绑定到一个磁盘上的 DeepSeek Harness 会话（应用重启丢失映射后的恢复手段）；不带参数列出最近会话',
  },
  {
    id: 'help',
    name: '/help',
    usage: '/help',
    description: '列出可用命令',
  },
];

const COMMAND_IDS = new Set<string>(SLASH_COMMANDS.map((command) => command.id));

/** 解析一行输入是否命中斜杠命令（不匹配大小写、允许命令名后紧跟空白或行尾）。 */
export function parseSlashCommand(input: string): SlashCommandMatch | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/')) return null;
  const match = trimmed.match(/^\/([a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/);
  if (!match) return null;
  const [, name, rest] = match;
  if (!COMMAND_IDS.has(name)) return null;
  return { command: name as SlashCommandId, rawArgs: (rest ?? '').trim() };
}

/** 提取输入首词的命令名（/word ... → word，小写）；非命令样式返回 null。 */
export function parseSlashCommandName(input: string): string | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith('/')) return null;
  const match = trimmed.match(/^\/([a-z][a-z0-9_-]*)(?:\s+([\s\S]*))?$/);
  return match ? match[1] : null;
}

/**
 * 其他工具（Claude Code / opencode 等）的常见命令名。用户带着习惯输入这些
 * 时，与其把 "/stop" 当普通消息发给模型，不如直接回执"未知命令 + 本产品
 * 命令清单"。传统命令注册表里的名字（clear/evolve/cost/cwd/skill/auto/mcp）
 * 不在此列——它们是真实命令，由 legacy 路由执行。
 */
const KNOWN_ELSEWHERE_COMMANDS = new Set([
  'new', 'continue', 'stop', 'exit', 'quit', 'restart', 'status', 'model',
]);

/** 输入形如已知他牌命令但鲲鹏未提供时，返回该命令名；否则 null。 */
export function isUnknownSlashCommandName(input: string): string | null {
  const name = parseSlashCommandName(input);
  if (!name || COMMAND_IDS.has(name)) return null;
  return KNOWN_ELSEWHERE_COMMANDS.has(name) ? name : null;
}

export function formatSlashHelpText(extra: readonly ExtraCommandSpec[] = []): string {
  const lines = [
    ...SLASH_COMMANDS.map((command) => `- **${command.usage}** — ${command.description}`),
    ...extra.map((command) => `- **${command.usage}** — ${command.description}`),
  ];
  return ['可用命令：', ...lines].join('\n');
}

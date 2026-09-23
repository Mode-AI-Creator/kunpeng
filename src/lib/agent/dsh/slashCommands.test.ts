import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSlashHelpText,
  isUnknownSlashCommandName,
  parseSlashCommand,
  parseSlashCommandName,
} from './slashCommands.ts';

test('parses known commands with and without args', () => {
  assert.deepEqual(parseSlashCommand('/compact'), { command: 'compact', rawArgs: '' });
  assert.deepEqual(parseSlashCommand('  /plan  '), { command: 'plan', rawArgs: '' });
  assert.deepEqual(parseSlashCommand('/plan off'), { command: 'plan', rawArgs: 'off' });
  assert.deepEqual(parseSlashCommand('/goal 完成第一集'), { command: 'goal', rawArgs: '完成第一集' });
  assert.deepEqual(parseSlashCommand('/help'), { command: 'help', rawArgs: '' });
});

test('unknown and malformed commands fall through as normal messages', () => {
  assert.equal(parseSlashCommand('/unknown'), null);
  assert.equal(parseSlashCommand('/pl an'), null);
  assert.equal(parseSlashCommand('hello /compact'), null);
  assert.equal(parseSlashCommand('/Compact'), null);
  assert.equal(parseSlashCommand('/'), null);
  assert.equal(parseSlashCommand('普通消息'), null);
});

test('help text lists every dsh command by default', () => {
  const text = formatSlashHelpText();
  for (const usage of ['/compact', '/plan', '/goal', '/resume', '/help']) {
    assert.match(text, new RegExp(usage.replace('/', '\\/')));
  }
});

test('flags well-known commands from other tools as unknown', () => {
  assert.equal(isUnknownSlashCommandName('/stop'), 'stop');
  assert.equal(isUnknownSlashCommandName('  /exit  now '), 'exit');
  // 鲲鹏自己的命令不算未知（/resume 已实现为真实命令）
  assert.equal(isUnknownSlashCommandName('/compact'), null);
  assert.equal(isUnknownSlashCommandName('/plan off'), null);
  assert.equal(isUnknownSlashCommandName('/resume 2'), null);
  // 传统命令（legacy 注册表）不算未知：由 legacy 路由执行
  assert.equal(isUnknownSlashCommandName('/clear'), null);
  assert.equal(isUnknownSlashCommandName('/auto'), null);
  // 非命令样式（路径开头、普通消息、罕见词）不拦
  assert.equal(isUnknownSlashCommandName('/Users/foo/bar.py 是什么'), null);
  assert.equal(isUnknownSlashCommandName('/fyi 我觉得'), null);
  assert.equal(isUnknownSlashCommandName('普通消息'), null);
});

test('parseSlashCommandName extracts the leading command word', () => {
  assert.equal(parseSlashCommandName('/resume 3'), 'resume');
  assert.equal(parseSlashCommandName('  /auto off  '), 'auto');
  assert.equal(parseSlashCommandName('普通消息'), null);
  assert.equal(parseSlashCommandName('/Users/foo/bar.py'), null);
  assert.equal(parseSlashCommandName('/plan'), 'plan');
});

test('help text merges dsh commands with legacy extras', () => {
  const text = formatSlashHelpText([
    { usage: '/auto', description: '开启全权限模式' },
    { usage: '/clear', description: '清空当前会话对话历史' },
  ]);
  for (const usage of ['/compact', '/plan', '/goal', '/resume', '/help', '/auto', '/clear']) {
    assert.match(text, new RegExp(usage.replace('/', '\\/')));
  }
  // DSH 命令排在传统命令之前
  assert.ok(text.indexOf('/resume') < text.indexOf('/auto'));
});

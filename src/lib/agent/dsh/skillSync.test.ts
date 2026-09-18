import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSkillCatalogUpdateNote,
  diffSkillCatalog,
  skillCatalogSignature,
  type SkillCatalogEntry,
} from './skillSync.ts';

const catalog: SkillCatalogEntry[] = [
  { name: 'one', invokable: true, visibility: 'toolbar' },
  { name: 'two', invokable: false, visibility: 'library', displayName: '二号技能' },
  { name: 'hidden', invokable: true, visibility: 'internal' },
];

test('signature ignores internal/disabled skills and ordering', () => {
  const shuffled: SkillCatalogEntry[] = [catalog[2], catalog[1], catalog[0]];
  assert.equal(skillCatalogSignature(catalog), skillCatalogSignature(shuffled));
  assert.equal(skillCatalogSignature(catalog), 'one:1|two:0');
  assert.equal(skillCatalogSignature([]), '');
});

test('diffSkillCatalog returns null when unchanged and reports added/removed names', () => {
  const before = skillCatalogSignature(catalog);
  assert.equal(diffSkillCatalog(before, before), null);

  const after = skillCatalogSignature([
    catalog[0],
    { name: 'three', invokable: true, visibility: 'toolbar' },
  ]);
  assert.deepEqual(diffSkillCatalog(before, after), { added: ['three'], removed: ['two'] });
  assert.deepEqual(diffSkillCatalog('', before), { added: ['one', 'two'], removed: [] });
});

test('update note labels invokable vs reference skills and lists removals', () => {
  const note = buildSkillCatalogUpdateNote(
    { added: ['two', 'three'], removed: ['old'] },
    [...catalog, { name: 'three', invokable: true, visibility: 'toolbar' }],
  );
  assert.match(note, /\[系统更新\]/);
  assert.match(note, /二号技能（参考型，按需读取其 SKILL\.md）/);
  assert.match(note, /three（可用 skill_invoke 调用）/);
  assert.match(note, /移除：old/);
});

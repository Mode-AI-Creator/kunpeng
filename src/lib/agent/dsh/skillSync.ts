/**
 * Live-bridge skill catalog sync.
 *
 * GLM/Kimi coordinators rebuild messages[0] every send, so they always see
 * the latest skill catalog. A DeepSeek Harness bridge bakes the persona
 * (including the skill list) into the ACP process at session start and cannot
 * rebuild it mid-run; while the bridge is alive, follow-up messages go
 * through queueGuidance. These helpers detect catalog changes between bridge
 * start and the next guidance, and render a system note prepended to that
 * guidance so the model learns about added/removed skills without a restart.
 */

export interface SkillCatalogEntry {
  name: string;
  displayName?: string;
  invokable?: boolean;
  visibility?: string;
}

/** Stable signature of the user-visible skill catalog for change detection. */
export function skillCatalogSignature(skills: SkillCatalogEntry[]): string {
  return skills
    .filter((skill) => skill.visibility !== 'internal' && skill.visibility !== 'disabled')
    .map((skill) => `${skill.name}:${skill.invokable ? 1 : 0}`)
    .sort()
    .join('|');
}

export interface SkillCatalogDiff {
  added: string[];
  removed: string[];
}

/** Returns null when the catalog is unchanged. */
export function diffSkillCatalog(before: string, after: string): SkillCatalogDiff | null {
  if (before === after) return null;
  const names = (sig: string) =>
    new Set(sig ? sig.split('|').map((part) => part.split(':')[0]) : []);
  const prev = names(before);
  const next = names(after);
  return {
    added: [...next].filter((name) => !prev.has(name)),
    removed: [...prev].filter((name) => !next.has(name)),
  };
}

/** Guidance prefix telling a live Harness bridge about the catalog change. */
export function buildSkillCatalogUpdateNote(
  diff: SkillCatalogDiff,
  skills: SkillCatalogEntry[],
): string {
  const parts: string[] = [];
  if (diff.added.length > 0) {
    const labels = diff.added.map((name) => {
      const skill = skills.find((entry) => entry.name === name);
      const label = skill?.displayName || name;
      return skill?.invokable
        ? `${label}（可用 skill_invoke 调用）`
        : `${label}（参考型，按需读取其 SKILL.md）`;
    });
    parts.push(`新增：${labels.join('、')}`);
  }
  if (diff.removed.length > 0) {
    parts.push(`移除：${diff.removed.join('、')}`);
  }
  return `[系统更新] 本会话的技能目录刚刚发生变化（${parts.join('；')}）。`
    + '后续请按最新目录使用技能，不要再引用已移除的技能。';
}

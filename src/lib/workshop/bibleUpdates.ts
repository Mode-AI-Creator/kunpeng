import { STEP_ORDER, type WorkshopData, type WorkshopProjectBibles } from './types.ts';

export type WorkshopBiblePatch = { [K in keyof WorkshopProjectBibles]?: Partial<NonNullable<WorkshopProjectBibles[K]>> };
const defaults = {
  director: { styleIntent: '', cameraRules: [], lightingRules: [], colorRules: [], pacingRules: [], forbidden: [] },
  character: { rules: [], globalRules: [] },
  scene: { rules: [], globalRules: [] },
  continuity: { lockedItems: [], blockingContinuity: [], referenceOrderRules: [], costumeContinuity: [], propContinuity: [], lightingContinuity: [], editContinuity: [] },
};
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Field patches preserve omitted categories/fields. Supplied arrays replace that field explicitly. */
export function patchWorkshopBibles(data: WorkshopData, patch: unknown, now = Date.now()): WorkshopData {
  if (!object(patch)) throw new Error('bibles 必须是对象；未修改的类别和字段请省略。');
  const bibles: WorkshopProjectBibles = { ...data.bibles };
  let changed = false;
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.prototype.hasOwnProperty.call(defaults, key)) throw new Error(`未知制作设定类别：${key}`);
    if (value === undefined) continue;
    if (!object(value)) throw new Error(`${key} 必须是对象，不能用 null 清除设定。`);
    const category = key as keyof WorkshopProjectBibles;
    const fields: Record<string, unknown> = {};
    const template = defaults[category] as Record<string, unknown>;
    for (const [field, item] of Object.entries(value)) {
      if (field === 'updatedAt' || item === undefined) continue;
      if (!Object.prototype.hasOwnProperty.call(template, field)) throw new Error(`未知制作设定字段：${key}.${field}`);
      if (Array.isArray(template[field])) {
        if (!Array.isArray(item) || item.some(entry => field === 'rules' ? !object(entry) : typeof entry !== 'string')) {
          throw new Error(`${key}.${field} 的列表格式不正确。`);
        }
      } else if (typeof item !== 'string') throw new Error(`${key}.${field} 必须是文本。`);
      fields[field] = structuredClone(item);
    }
    if (Object.keys(fields).length === 0) continue;
    const previous = data.bibles?.[category];
    const baseline: Record<string, unknown> = { ...structuredClone(template), ...previous };
    if (previous && Object.entries(fields).every(([field, value]) => JSON.stringify(baseline[field]) === JSON.stringify(value))) continue;
    Object.assign(bibles, { [category]: { ...baseline, ...fields, updatedAt: now } });
    changed = true;
  }
  if (!changed) return data;
  // Reuse existing step indicators; never regenerate, clear media, or interrupt active work.
  const steps = { ...data.steps };
  for (const step of STEP_ORDER.slice(STEP_ORDER.indexOf('breakdown') + 1)) {
    if (steps[step].status === 'done') steps[step] = { ...steps[step], status: 'stale', updatedAt: now };
  }
  return { ...data, bibles, steps };
}

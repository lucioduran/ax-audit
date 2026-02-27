import type { CheckMeta, CheckResult, Finding } from '../types.js';

export function buildResult(meta: CheckMeta, score: number, findings: Finding[], start: number): CheckResult {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    score,
    findings,
    duration: Math.round(performance.now() - start),
  };
}

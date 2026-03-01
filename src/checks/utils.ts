import type { CheckMeta, CheckResult, Finding } from '../types.js';

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function buildResult(meta: CheckMeta, score: number, findings: Finding[], start: number): CheckResult {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    score: clampScore(score),
    findings,
    duration: Math.round(performance.now() - start),
  };
}

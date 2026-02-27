import { CHECK_WEIGHTS, GRADES } from './constants.js';
import type { CheckResult, CheckMeta, Grade } from './types.js';

export function calculateOverallScore(results: CheckResult[], metas: CheckMeta[]): number {
  const weightMap: Record<string, number> = {};
  let totalWeight = 0;

  for (const m of metas) {
    weightMap[m.id] = m.weight ?? CHECK_WEIGHTS[m.id] ?? 10;
    totalWeight += weightMap[m.id];
  }

  let weightedSum = 0;
  for (const r of results) {
    const weight = weightMap[r.id] || 0;
    weightedSum += (r.score / 100) * weight;
  }

  const overall = Math.round((weightedSum / totalWeight) * 100);
  return Math.max(0, Math.min(100, overall));
}

export function getGrade(score: number): Grade {
  for (const grade of GRADES) {
    if (score >= grade.min) return grade;
  }
  return GRADES[GRADES.length - 1];
}

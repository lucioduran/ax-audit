import { CHECK_WEIGHTS, GRADES } from './constants.js';

/**
 * Calculate the weighted overall score from individual check results.
 * Re-normalizes if only a subset of checks was run.
 */
export function calculateOverallScore(results, metas) {
  const weightMap = {};
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

/**
 * Map a numeric score to a grade.
 */
export function getGrade(score) {
  for (const grade of GRADES) {
    if (score >= grade.min) return grade;
  }
  return GRADES[GRADES.length - 1];
}

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditReport, BaselineData, BaselineDiff, CheckDiff } from './types.js';

/**
 * Extract a minimal, stable snapshot from an AuditReport suitable for
 * persistence and future comparison.
 */
export function toBaselineData(report: AuditReport): BaselineData {
  const checks: Record<string, number> = {};
  for (const r of report.results) {
    checks[r.id] = r.score;
  }
  return {
    url: report.url,
    timestamp: report.timestamp,
    overallScore: report.overallScore,
    checks,
  };
}

/**
 * Persist a baseline to disk as pretty-printed JSON.
 * Creates intermediate directories if they don't exist.
 */
export function saveBaseline(path: string, report: AuditReport): void {
  const data = toBaselineData(report);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Load a previously saved baseline from disk.
 * Throws with a clear message on missing file or invalid JSON.
 */
export function loadBaseline(path: string): BaselineData {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(`Baseline file not found: ${path}`, { cause: err });
    }
    throw err;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (cause: unknown) {
    throw new Error(`Baseline file is not valid JSON: ${path}`, { cause });
  }

  if (!isBaselineData(data)) {
    throw new Error(`Baseline file has invalid structure (expected url, timestamp, overallScore, checks): ${path}`);
  }

  return data;
}

/**
 * Compare a current audit report against a stored baseline, producing
 * per-check deltas and overall regression/improvement lists.
 */
export function diffBaseline(baseline: BaselineData, report: AuditReport): BaselineDiff {
  const checks: CheckDiff[] = report.results.map((r) => {
    const previous = baseline.checks[r.id] ?? 0;
    return {
      id: r.id,
      name: r.name,
      previous,
      current: r.score,
      delta: r.score - previous,
    };
  });

  // Include checks that existed in the baseline but were removed from the current run
  for (const [id, score] of Object.entries(baseline.checks)) {
    if (!checks.some((c) => c.id === id)) {
      checks.push({
        id,
        name: id, // no human-readable name available for removed checks
        previous: score,
        current: 0,
        delta: -score,
      });
    }
  }

  const overallDelta = report.overallScore - baseline.overallScore;

  return {
    url: report.url,
    baselineTimestamp: baseline.timestamp,
    currentTimestamp: report.timestamp,
    overallPrevious: baseline.overallScore,
    overallCurrent: report.overallScore,
    overallDelta,
    checks,
    regressions: checks.filter((c) => c.delta < 0),
    improvements: checks.filter((c) => c.delta > 0),
  };
}

/* ── Internal helpers ─────────────────────────────────────── */

function isBaselineData(value: unknown): value is BaselineData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.url === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.overallScore === 'number' &&
    typeof obj.checks === 'object' &&
    obj.checks !== null &&
    !Array.isArray(obj.checks)
  );
}

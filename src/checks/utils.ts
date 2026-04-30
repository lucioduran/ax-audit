import { guideUrl } from '../guide-urls.js';
import type { CheckMeta, CheckResult, FetchResponse, Finding } from '../types.js';

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

/**
 * Validate the `Content-Type` of a fetched resource against a list of acceptable MIME types.
 *
 * Returns:
 * - `null` when the content type is acceptable (no finding to add)
 * - a `Finding` describing the mismatch otherwise (caller decides whether to apply a score penalty)
 */
export function checkContentType(
  res: FetchResponse,
  expected: string[],
  context: { checkId: string; resourceLabel: string; anchor: string },
): Finding | null {
  const ct = (res.headers['content-type'] ?? '').toLowerCase();
  if (!ct) {
    return {
      status: 'warn',
      message: `${context.resourceLabel} has no Content-Type header`,
      hint: `Serve ${context.resourceLabel} with one of: ${expected.join(', ')}.`,
      learnMoreUrl: guideUrl(context.checkId, context.anchor),
    };
  }
  if (expected.some((mime) => ct.includes(mime))) return null;
  return {
    status: 'warn',
    message: `${context.resourceLabel} Content-Type is "${ct.split(';')[0]}"`,
    detail: `Expected one of: ${expected.join(', ')}`,
    hint: `Configure your server to serve ${context.resourceLabel} as ${expected[0]} so AI agents parse it correctly.`,
    learnMoreUrl: guideUrl(context.checkId, context.anchor),
  };
}

import { createFetcher } from './fetcher.js';
import { checks as allChecks } from './checks/index.js';
import { calculateOverallScore, getGrade } from './scorer.js';

/**
 * Run a full AX audit on a URL.
 * @param {{ url: string, checks?: string[], timeout?: number }} options
 */
export async function audit(options) {
  const startTime = performance.now();
  const fetcher = createFetcher({ timeout: options.timeout || 10000 });

  // Pre-fetch homepage (shared across checks that need HTML/headers)
  const homepage = await fetcher.fetchPage(options.url);

  const ctx = {
    url: options.url.replace(/\/$/, ''),
    fetch: fetcher.fetch,
    html: homepage.body,
    headers: homepage.headers,
  };

  // Filter checks if --checks flag was used
  const checksToRun = options.checks
    ? allChecks.filter(c => options.checks.includes(c.meta.id))
    : allChecks;

  // Run all checks in parallel (Promise.allSettled for resilience)
  const settled = await Promise.allSettled(
    checksToRun.map(c => c.run(ctx))
  );

  // Collect results, handle crashed checks gracefully
  const results = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      id: checksToRun[i].meta.id,
      name: checksToRun[i].meta.name,
      description: checksToRun[i].meta.description,
      score: 0,
      findings: [{ status: 'fail', message: `Check crashed: ${s.reason?.message || 'Unknown error'}` }],
      duration: 0,
    };
  });

  const overallScore = calculateOverallScore(results, checksToRun.map(c => c.meta));
  const grade = getGrade(overallScore);

  return {
    url: options.url,
    timestamp: new Date().toISOString(),
    overallScore,
    grade,
    results,
    duration: Math.round(performance.now() - startTime),
  };
}

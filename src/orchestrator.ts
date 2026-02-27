import { createFetcher } from './fetcher.js';
import { checks as allChecks } from './checks/index.js';
import { calculateOverallScore, getGrade } from './scorer.js';
import type { AuditOptions, AuditReport, CheckContext, CheckResult } from './types.js';

export async function audit(options: AuditOptions): Promise<AuditReport> {
  const startTime = performance.now();
  const verbose = options.verbose || false;
  const log = verbose ? (msg: string) => console.error(`  [verbose] ${msg}`) : () => {};
  const fetcher = createFetcher({ timeout: options.timeout || 10000, verbose });

  const homepage = await fetcher.fetchPage(options.url);

  const ctx: CheckContext = {
    url: options.url.replace(/\/$/, ''),
    fetch: fetcher.fetch,
    html: homepage.body,
    headers: homepage.headers,
  };

  const checksToRun = options.checks ? allChecks.filter((c) => options.checks!.includes(c.meta.id)) : allChecks;

  log(`running ${checksToRun.length} check(s): ${checksToRun.map((c) => c.meta.id).join(', ')}`);

  const settled = await Promise.allSettled(checksToRun.map((c) => c.run(ctx)));

  const results: CheckResult[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') {
      log(`${checksToRun[i].meta.id}: score=${s.value.score} (${s.value.duration}ms)`);
      return s.value;
    }
    log(`${checksToRun[i].meta.id}: CRASHED — ${s.reason?.message || 'Unknown error'}`);
    return {
      id: checksToRun[i].meta.id,
      name: checksToRun[i].meta.name,
      description: checksToRun[i].meta.description,
      score: 0,
      findings: [{ status: 'fail' as const, message: `Check crashed: ${s.reason?.message || 'Unknown error'}` }],
      duration: 0,
    };
  });

  const overallScore = calculateOverallScore(
    results,
    checksToRun.map((c) => c.meta),
  );
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

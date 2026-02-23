import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'openapi',
  name: 'OpenAPI Spec',
  description: 'Checks /.well-known/openapi.json presence and validity',
  weight: 8,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/.well-known/openapi.json`);

  if (!res.ok) {
    findings.push({
      status: 'fail',
      message: '/.well-known/openapi.json not found',
      detail: `HTTP ${res.status || 'network error'}`,
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/openapi.json exists' });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({ status: 'fail', message: 'Invalid JSON' });
    return buildResult(meta, 10, findings, start);
  }
  findings.push({ status: 'pass', message: 'Valid JSON' });

  if (data.openapi) {
    findings.push({ status: 'pass', message: `OpenAPI version: ${data.openapi}` });
  } else if (data.swagger) {
    findings.push({ status: 'warn', message: `Swagger version: ${data.swagger} (consider upgrading to OpenAPI 3.x)` });
    score -= 10;
  } else {
    findings.push({ status: 'fail', message: 'No openapi or swagger version field' });
    score -= 20;
  }

  const info = data.info as Record<string, unknown> | undefined;
  if (info?.title) {
    findings.push({ status: 'pass', message: `API title: "${info.title}"` });
  } else {
    findings.push({ status: 'warn', message: 'Missing info.title' });
    score -= 10;
  }

  if (info?.description) {
    findings.push({ status: 'pass', message: 'API description present' });
  } else {
    findings.push({ status: 'warn', message: 'Missing info.description' });
    score -= 5;
  }

  const paths = data.paths as Record<string, unknown> | undefined;
  if (paths && Object.keys(paths).length > 0) {
    findings.push({ status: 'pass', message: `${Object.keys(paths).length} path(s) documented` });
  } else {
    findings.push({ status: 'warn', message: 'No paths documented' });
    score -= 15;
  }

  if (Array.isArray(data.servers) && data.servers.length > 0) {
    findings.push({ status: 'pass', message: `${data.servers.length} server(s) defined` });
  } else {
    findings.push({ status: 'warn', message: 'No servers defined' });
    score -= 5;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

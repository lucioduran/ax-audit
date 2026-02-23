import { AGENT_JSON_REQUIRED_FIELDS } from '../constants.js';
import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'agent-json',
  name: 'Agent Card (A2A)',
  description: 'Checks /.well-known/agent.json A2A protocol compliance',
  weight: 10,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/.well-known/agent.json`);

  if (!res.ok) {
    findings.push({
      status: 'fail',
      message: '/.well-known/agent.json not found',
      detail: `HTTP ${res.status || 'network error'}`,
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/agent.json exists' });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({ status: 'fail', message: 'Invalid JSON' });
    return buildResult(meta, 10, findings, start);
  }
  findings.push({ status: 'pass', message: 'Valid JSON' });

  for (const field of AGENT_JSON_REQUIRED_FIELDS) {
    if (data[field] !== undefined && data[field] !== null) {
      findings.push({ status: 'pass', message: `Required field "${field}" present` });
    } else {
      findings.push({ status: 'fail', message: `Required field "${field}" missing` });
      score -= 15;
    }
  }

  if (Array.isArray(data.skills) && data.skills.length > 0) {
    findings.push({ status: 'pass', message: `${data.skills.length} skill(s) defined` });
  } else if (Array.isArray(data.skills)) {
    findings.push({ status: 'warn', message: 'Skills array is empty' });
    score -= 10;
  }

  if (data.protocolVersion) {
    findings.push({ status: 'pass', message: `Protocol version: ${data.protocolVersion}` });
  } else {
    findings.push({ status: 'warn', message: 'No protocolVersion field' });
    score -= 5;
  }

  const optionalFields = ['capabilities', 'authentication', 'documentationUrl'];
  const presentOptional = optionalFields.filter((f) => data[f] !== undefined);
  if (presentOptional.length === optionalFields.length) {
    findings.push({
      status: 'pass',
      message: 'All optional fields present (capabilities, authentication, documentationUrl)',
    });
  } else if (presentOptional.length > 0) {
    findings.push({
      status: 'pass',
      message: `${presentOptional.length}/${optionalFields.length} optional fields present`,
    });
  } else {
    findings.push({ status: 'warn', message: 'No optional fields (capabilities, authentication, documentationUrl)' });
    score -= 5;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

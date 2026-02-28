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
      hint: "Create a /.well-known/agent.json file following the A2A (Agent-to-Agent) protocol. It should include name, description, url, and skills fields describing your site's capabilities.",
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/agent.json exists' });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({
      status: 'fail',
      message: 'Invalid JSON',
      hint: 'Fix the JSON syntax in your agent.json file. Validate it with a JSON linter.',
    });
    return buildResult(meta, 10, findings, start);
  }
  findings.push({ status: 'pass', message: 'Valid JSON' });

  for (const field of AGENT_JSON_REQUIRED_FIELDS) {
    if (data[field] !== undefined && data[field] !== null) {
      findings.push({ status: 'pass', message: `Required field "${field}" present` });
    } else {
      findings.push({
        status: 'fail',
        message: `Required field "${field}" missing`,
        hint: `Add the "${field}" field to your agent.json. This is required by the A2A protocol specification.`,
      });
      score -= 15;
    }
  }

  if (Array.isArray(data.skills) && data.skills.length > 0) {
    findings.push({ status: 'pass', message: `${data.skills.length} skill(s) defined` });
  } else if (Array.isArray(data.skills)) {
    findings.push({
      status: 'warn',
      message: 'Skills array is empty',
      hint: 'Add at least one skill to the skills array describing what your agent/site can do.',
    });
    score -= 10;
  }

  if (data.protocolVersion) {
    findings.push({ status: 'pass', message: `Protocol version: ${data.protocolVersion}` });
  } else {
    findings.push({
      status: 'warn',
      message: 'No protocolVersion field',
      hint: 'Add "protocolVersion": "0.2.0" to your agent.json to declare A2A protocol compatibility.',
    });
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
    findings.push({
      status: 'warn',
      message: 'No optional fields (capabilities, authentication, documentationUrl)',
      hint: 'Consider adding capabilities (what protocols you support), authentication (auth requirements), and documentationUrl (link to API docs).',
    });
    score -= 5;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

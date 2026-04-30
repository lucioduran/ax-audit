import { AGENT_JSON_REQUIRED_FIELDS } from '../constants.js';
import { guideUrl } from '../guide-urls.js';
import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult, checkContentType } from './utils.js';

/**
 * "agent-json" — `/.well-known/agent.json` per the A2A (Agent-to-Agent) protocol.
 *
 * Validates the document on three axes:
 * 1. JSON well-formedness
 * 2. Required fields per the A2A spec (`name`, `description`, `url`, `skills`)
 * 3. Field semantics: `url` should resolve to the same origin as the audited site,
 *    `skills[]` should each declare an `id` and `description`, and protocol/optional
 *    fields are present where expected.
 */
export const meta: CheckMeta = {
  id: 'agent-json',
  name: 'Agent Card (A2A)',
  description: 'Checks /.well-known/agent.json A2A protocol compliance',
  weight: 7,
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
      learnMoreUrl: guideUrl(meta.id, 'not-found'),
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/agent.json exists' });

  const ctFinding = checkContentType(res, ['application/json'], {
    checkId: meta.id,
    resourceLabel: '/.well-known/agent.json',
    anchor: 'wrong-content-type',
  });
  if (ctFinding) {
    findings.push(ctFinding);
    score -= 5;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({
      status: 'fail',
      message: 'Invalid JSON',
      hint: 'Fix the JSON syntax in your agent.json file. Validate it with a JSON linter.',
      learnMoreUrl: guideUrl(meta.id, 'invalid-json'),
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
        learnMoreUrl: guideUrl(meta.id, 'missing-field'),
      });
      score -= 15;
    }
  }

  if (typeof data.url === 'string' && data.url.length > 0) {
    const sameOrigin = sameHost(data.url, ctx.url);
    if (sameOrigin === false) {
      findings.push({
        status: 'warn',
        message: `agent.json "url" points to a different origin: ${data.url}`,
        hint: 'The url field should match the audited site origin. Pointing it elsewhere can confuse agents about the canonical agent endpoint.',
        learnMoreUrl: guideUrl(meta.id, 'url-mismatch'),
      });
      score -= 5;
    } else if (sameOrigin === null) {
      findings.push({
        status: 'warn',
        message: `agent.json "url" is not a valid absolute URL: ${data.url}`,
        hint: 'Provide an absolute https:// URL for the url field.',
        learnMoreUrl: guideUrl(meta.id, 'url-invalid'),
      });
      score -= 5;
    }
  }

  if (Array.isArray(data.skills) && data.skills.length > 0) {
    findings.push({ status: 'pass', message: `${data.skills.length} skill(s) defined` });
    const incomplete = (data.skills as Record<string, unknown>[]).filter((s) => !s.id || !s.description);
    if (incomplete.length === 0) {
      findings.push({ status: 'pass', message: 'All skills have id + description' });
    } else {
      findings.push({
        status: 'warn',
        message: `${incomplete.length}/${data.skills.length} skill(s) missing id or description`,
        hint: 'Each entry in skills[] should include both an id and a description so agents can address it and reason about its purpose.',
        learnMoreUrl: guideUrl(meta.id, 'incomplete-skills'),
      });
      score -= 5;
    }
  } else if (Array.isArray(data.skills)) {
    findings.push({
      status: 'warn',
      message: 'Skills array is empty',
      hint: 'Add at least one skill to the skills array describing what your agent/site can do.',
      learnMoreUrl: guideUrl(meta.id, 'empty-skills'),
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
      learnMoreUrl: guideUrl(meta.id, 'no-protocol-version'),
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
      learnMoreUrl: guideUrl(meta.id, 'missing-optional'),
    });
    score -= 5;
  }

  return buildResult(meta, score, findings, start);
}

/** Returns `true` when the two URLs share host (case-insensitive), `false` if hosts differ, `null` on parse error. */
function sameHost(a: string, b: string): boolean | null {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return ua.host.toLowerCase() === ub.host.toLowerCase();
  } catch {
    return null;
  }
}

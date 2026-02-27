import { SECURITY_HEADERS } from '../constants.js';
import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';

export const meta: CheckMeta = {
  id: 'http-headers',
  name: 'HTTP Headers',
  description: 'Checks security headers, AI discovery Link headers, and CORS',
  weight: 15,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const headers = ctx.headers;
  if (!headers || Object.keys(headers).length === 0) {
    findings.push({ status: 'fail', message: 'Could not fetch homepage headers' });
    return build(0, findings, start);
  }

  let securityCount = 0;
  for (const header of SECURITY_HEADERS) {
    if (headers[header.name]) {
      securityCount++;
    } else if (header.critical) {
      findings.push({ status: 'fail', message: `Missing critical header: ${header.label}` });
      score -= 10;
    }
  }

  if (securityCount === SECURITY_HEADERS.length) {
    findings.push({ status: 'pass', message: `All ${SECURITY_HEADERS.length} security headers present` });
  } else if (securityCount >= 4) {
    findings.push({ status: 'pass', message: `${securityCount}/${SECURITY_HEADERS.length} security headers present` });
  } else {
    findings.push({ status: 'warn', message: `Only ${securityCount}/${SECURITY_HEADERS.length} security headers present` });
    score -= 5;
  }

  const linkHeader = headers['link'] || '';
  const hasLlmsLink = /llms\.txt/i.test(linkHeader);
  const hasAgentLink = /agent\.json/i.test(linkHeader);

  if (hasLlmsLink && hasAgentLink) {
    findings.push({ status: 'pass', message: 'Link header references both llms.txt and agent.json' });
  } else if (hasLlmsLink) {
    findings.push({ status: 'pass', message: 'Link header references llms.txt' });
    findings.push({ status: 'warn', message: 'Link header does not reference agent.json' });
    score -= 5;
  } else if (hasAgentLink) {
    findings.push({ status: 'pass', message: 'Link header references agent.json' });
    findings.push({ status: 'warn', message: 'Link header does not reference llms.txt' });
    score -= 5;
  } else if (linkHeader) {
    findings.push({ status: 'warn', message: 'Link header present but does not reference AI discovery files' });
    score -= 15;
  } else {
    findings.push({ status: 'warn', message: 'No Link header for AI discovery (llms.txt, agent.json)' });
    score -= 15;
  }

  const wellKnownRes = await ctx.fetch(`${ctx.url}/.well-known/agent.json`);
  if (wellKnownRes.ok) {
    const cors = wellKnownRes.headers['access-control-allow-origin'];
    if (cors) {
      findings.push({ status: 'pass', message: 'CORS enabled on .well-known resources' });
    } else {
      findings.push({ status: 'warn', message: 'No CORS headers on .well-known resources' });
      score -= 10;
    }
  }

  const llmsRes = await ctx.fetch(`${ctx.url}/llms.txt`);
  if (llmsRes.ok && llmsRes.headers['x-robots-tag']?.includes('noindex')) {
    findings.push({ status: 'pass', message: 'X-Robots-Tag: noindex on /llms.txt (prevents search indexing of raw text)' });
  }

  return build(Math.max(0, Math.min(100, score)), findings, start);
}

function build(score: number, findings: Finding[], start: number): CheckResult {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}

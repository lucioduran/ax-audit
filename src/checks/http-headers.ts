import { SECURITY_HEADERS } from '../constants.js';
import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

interface LinkEntry {
  url: string;
  params: Record<string, string>;
}

/** Parse an RFC 5988 Link header into structured entries. */
export function parseLinkHeader(header: string): LinkEntry[] {
  if (!header) return [];

  const entries: LinkEntry[] = [];
  const parts = splitLinkHeader(header);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const urlMatch = trimmed.match(/^<([^>]*)>/);
    if (!urlMatch) continue;

    const url = urlMatch[1];
    const rest = trimmed.slice(urlMatch[0].length);
    const params: Record<string, string> = {};

    const paramRegex = /;\s*([^=\s]+)\s*=\s*(?:"([^"]*)"|([^\s;,]*))/g;
    let match;
    while ((match = paramRegex.exec(rest)) !== null) {
      params[match[1].toLowerCase()] = match[2] ?? match[3];
    }

    entries.push({ url, params });
  }

  return entries;
}

/** Split a Link header value by commas, respecting angle brackets. */
function splitLinkHeader(header: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inAngle = false;
  let inQuote = false;

  for (let i = 0; i < header.length; i++) {
    const ch = header[i];

    if (ch === '"' && !inAngle) {
      inQuote = !inQuote;
      current += ch;
    } else if (ch === '<' && !inQuote) {
      inAngle = true;
      current += ch;
    } else if (ch === '>' && !inQuote) {
      inAngle = false;
      current += ch;
    } else if (ch === ',' && !inAngle && !inQuote) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

export const meta: CheckMeta = {
  id: 'http-headers',
  name: 'HTTP Headers',
  description: 'Checks security headers, AI discovery Link headers, and CORS',
  weight: 13,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const headers = ctx.headers;
  if (!headers || Object.keys(headers).length === 0) {
    findings.push({ status: 'fail', message: 'Could not fetch homepage headers' });
    return buildResult(meta, 0, findings, start);
  }

  let securityCount = 0;
  for (const header of SECURITY_HEADERS) {
    if (headers[header.name]) {
      securityCount++;
    } else if (header.critical) {
      findings.push({
        status: 'fail',
        message: `Missing critical header: ${header.label}`,
        hint: `Add the ${header.label} response header to your server configuration. This is a critical security header.`,
      });
      score -= 10;
    }
  }

  if (securityCount === SECURITY_HEADERS.length) {
    findings.push({ status: 'pass', message: `All ${SECURITY_HEADERS.length} security headers present` });
  } else if (securityCount >= 4) {
    findings.push({ status: 'pass', message: `${securityCount}/${SECURITY_HEADERS.length} security headers present` });
  } else {
    findings.push({
      status: 'warn',
      message: `Only ${securityCount}/${SECURITY_HEADERS.length} security headers present`,
      hint: 'Add security headers like Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, and Referrer-Policy to your server response.',
    });
    score -= 5;
  }

  const linkHeader = headers['link'] || '';
  const links = parseLinkHeader(linkHeader);
  const hasLlmsLink = links.some((l) => /llms\.txt/i.test(l.url));
  const hasAgentLink = links.some((l) => /agent\.json/i.test(l.url));

  if (hasLlmsLink && hasAgentLink) {
    findings.push({ status: 'pass', message: 'Link header references both llms.txt and agent.json' });
  } else if (hasLlmsLink) {
    findings.push({ status: 'pass', message: 'Link header references llms.txt' });
    findings.push({
      status: 'warn',
      message: 'Link header does not reference agent.json',
      hint: 'Add agent.json to your Link header: Link: </.well-known/agent.json>; rel="alternate"; type="application/json"',
    });
    score -= 5;
  } else if (hasAgentLink) {
    findings.push({ status: 'pass', message: 'Link header references agent.json' });
    findings.push({
      status: 'warn',
      message: 'Link header does not reference llms.txt',
      hint: 'Add llms.txt to your Link header: Link: </llms.txt>; rel="alternate"; type="text/plain"',
    });
    score -= 5;
  } else if (linkHeader) {
    findings.push({
      status: 'warn',
      message: 'Link header present but does not reference AI discovery files',
      hint: 'Add AI discovery entries to your Link header: Link: </llms.txt>; rel="alternate"; type="text/plain", </.well-known/agent.json>; rel="alternate"; type="application/json"',
    });
    score -= 15;
  } else {
    findings.push({
      status: 'warn',
      message: 'No Link header for AI discovery (llms.txt, agent.json)',
      hint: 'Add a Link response header pointing to your AI discovery files: Link: </llms.txt>; rel="alternate"; type="text/plain", </.well-known/agent.json>; rel="alternate"; type="application/json"',
    });
    score -= 15;
  }

  const wellKnownRes = await ctx.fetch(`${ctx.url}/.well-known/agent.json`);
  if (wellKnownRes.ok) {
    const cors = wellKnownRes.headers['access-control-allow-origin'];
    if (cors) {
      findings.push({ status: 'pass', message: 'CORS enabled on .well-known resources' });
    } else {
      findings.push({
        status: 'warn',
        message: 'No CORS headers on .well-known resources',
        hint: 'Add Access-Control-Allow-Origin: * to responses from /.well-known/* so AI agents from other domains can fetch your discovery files.',
      });
      score -= 10;
    }
  }

  const llmsRes = await ctx.fetch(`${ctx.url}/llms.txt`);
  if (llmsRes.ok && llmsRes.headers['x-robots-tag']?.includes('noindex')) {
    findings.push({
      status: 'pass',
      message: 'X-Robots-Tag: noindex on /llms.txt (prevents search indexing of raw text)',
    });
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

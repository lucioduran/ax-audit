import { SECURITY_TXT_REQUIRED_FIELDS } from '../constants.js';

export const meta = {
  id: 'security-txt',
  name: 'Security.txt',
  description: 'Checks /.well-known/security.txt RFC 9116 compliance',
  weight: 10,
};

export default async function check(ctx) {
  const start = performance.now();
  const findings = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/.well-known/security.txt`);

  if (!res.ok) {
    findings.push({ status: 'fail', message: '/.well-known/security.txt not found', detail: `HTTP ${res.status || 'network error'}` });
    return result(0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/security.txt exists' });
  const text = res.body;

  // Required fields
  for (const field of SECURITY_TXT_REQUIRED_FIELDS) {
    const regex = new RegExp(`^${field}:`, 'mi');
    if (regex.test(text)) {
      findings.push({ status: 'pass', message: `Required field "${field}" present` });
    } else {
      findings.push({ status: 'fail', message: `Required field "${field}" missing (RFC 9116)` });
      score -= 25;
    }
  }

  // Expires not in the past
  const expiresMatch = text.match(/^Expires:\s*(.+)/mi);
  if (expiresMatch) {
    const expiresDate = new Date(expiresMatch[1].trim());
    if (!isNaN(expiresDate.getTime())) {
      if (expiresDate > new Date()) {
        findings.push({ status: 'pass', message: `Expires date is in the future (${expiresDate.toISOString().split('T')[0]})` });
      } else {
        findings.push({ status: 'fail', message: 'Expires date is in the past — security.txt is expired' });
        score -= 20;
      }
    }
  }

  // Optional fields
  const optionalFields = ['Canonical', 'Preferred-Languages', 'Policy', 'Encryption', 'Hiring'];
  const present = optionalFields.filter(f => new RegExp(`^${f}:`, 'mi').test(text));
  if (present.length >= 3) {
    findings.push({ status: 'pass', message: `${present.length}/${optionalFields.length} optional fields present` });
  } else if (present.length > 0) {
    findings.push({ status: 'pass', message: `${present.length}/${optionalFields.length} optional fields present` });
  } else {
    findings.push({ status: 'warn', message: 'No optional fields (Canonical, Preferred-Languages, Policy, etc.)' });
    score -= 5;
  }

  return result(Math.max(0, score), findings, start);
}

function result(score, findings, start) {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}

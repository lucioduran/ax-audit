import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'llms-txt',
  name: 'LLMs.txt',
  description: 'Checks /llms.txt presence and spec compliance',
  weight: 15,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/llms.txt`);

  if (!res.ok) {
    findings.push({ status: 'fail', message: '/llms.txt not found', detail: `HTTP ${res.status || 'network error'}` });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/llms.txt exists' });
  const text = res.body;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  if (!lines[0]?.startsWith('# ')) {
    findings.push({ status: 'warn', message: 'Missing H1 heading (first line should start with "# ")' });
    score -= 15;
  } else {
    findings.push({ status: 'pass', message: `H1 heading: "${lines[0].slice(2)}"` });
  }

  const hasBlockquote = lines.some(l => l.startsWith('> '));
  if (!hasBlockquote) {
    findings.push({ status: 'warn', message: 'No blockquote description found ("> ...")' });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: 'Blockquote description present' });
  }

  const sections = lines.filter(l => l.startsWith('## '));
  if (sections.length === 0) {
    findings.push({ status: 'warn', message: 'No section headings found (## ...)' });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: `${sections.length} section heading(s) found` });
  }

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const links = [...text.matchAll(linkPattern)];
  if (links.length === 0) {
    findings.push({ status: 'warn', message: 'No Markdown links found' });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: `${links.length} link(s) found` });
  }

  if (text.length < 100) {
    findings.push({ status: 'warn', message: 'Content appears minimal (< 100 characters)' });
    score -= 10;
  }

  const fullRes = await ctx.fetch(`${ctx.url}/llms-full.txt`);
  if (fullRes.ok) {
    findings.push({ status: 'pass', message: '/llms-full.txt also available (bonus)' });
    score = Math.min(100, score + 10);
  } else {
    findings.push({ status: 'warn', message: '/llms-full.txt not found (optional but recommended)' });
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

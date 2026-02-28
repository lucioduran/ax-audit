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
    findings.push({
      status: 'fail',
      message: '/llms.txt not found',
      detail: `HTTP ${res.status || 'network error'}`,
      hint: 'Create a /llms.txt file at your site root following the llmstxt.org specification. It should be a Markdown file starting with "# Your Site Name" and include a description, sections, and links.',
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/llms.txt exists' });
  const text = res.body;
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines[0]?.startsWith('# ')) {
    findings.push({
      status: 'warn',
      message: 'Missing H1 heading (first line should start with "# ")',
      hint: 'Add an H1 heading as the first line of your llms.txt file, e.g.: # Your Site Name',
    });
    score -= 15;
  } else {
    findings.push({ status: 'pass', message: `H1 heading: "${lines[0].slice(2)}"` });
  }

  const hasBlockquote = lines.some((l) => l.startsWith('> '));
  if (!hasBlockquote) {
    findings.push({
      status: 'warn',
      message: 'No blockquote description found ("> ...")',
      hint: 'Add a blockquote description after the H1 heading, e.g.: > A brief summary of your site for AI agents.',
    });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: 'Blockquote description present' });
  }

  const sections = lines.filter((l) => l.startsWith('## '));
  if (sections.length === 0) {
    findings.push({
      status: 'warn',
      message: 'No section headings found (## ...)',
      hint: 'Organize your llms.txt content with ## section headings (e.g., ## About, ## API, ## Documentation).',
    });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: `${sections.length} section heading(s) found` });
  }

  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const links = [...text.matchAll(linkPattern)];
  if (links.length === 0) {
    findings.push({
      status: 'warn',
      message: 'No Markdown links found',
      hint: 'Add Markdown links to relevant pages: [Page Title](https://example.com/page). This helps AI agents navigate your site.',
    });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: `${links.length} link(s) found` });
  }

  if (text.length < 100) {
    findings.push({
      status: 'warn',
      message: 'Content appears minimal (< 100 characters)',
      hint: 'Expand your llms.txt with more descriptive content about your site, its purpose, and available resources.',
    });
    score -= 10;
  }

  const fullRes = await ctx.fetch(`${ctx.url}/llms-full.txt`);
  if (fullRes.ok) {
    findings.push({ status: 'pass', message: '/llms-full.txt also available (bonus)' });
    score = Math.min(100, score + 10);
  } else {
    findings.push({
      status: 'warn',
      message: '/llms-full.txt not found (optional but recommended)',
      hint: 'Create a /llms-full.txt with expanded content — full documentation, API details, and comprehensive site information for AI agents.',
    });
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

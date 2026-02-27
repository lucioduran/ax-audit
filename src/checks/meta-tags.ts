import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'meta-tags',
  name: 'Meta Tags',
  description: 'Checks AI meta tags, rel="alternate", and rel="me" links',
  weight: 8,
};

const AI_META_NAMES = ['ai:summary', 'ai:content_type', 'ai:author', 'ai:api', 'ai:agent_card'];

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const html = ctx.html;
  if (!html) {
    findings.push({ status: 'fail', message: 'Could not fetch homepage HTML' });
    return buildResult(meta, 0, findings, start);
  }

  const foundAiMeta = AI_META_NAMES.filter((name) => {
    const pattern = new RegExp(`<meta\\s+[^>]*name=["']${escapeRegex(name)}["'][^>]*>`, 'i');
    return pattern.test(html);
  });

  if (foundAiMeta.length >= 3) {
    findings.push({
      status: 'pass',
      message: `${foundAiMeta.length}/${AI_META_NAMES.length} AI meta tags found`,
      detail: foundAiMeta.join(', '),
    });
  } else if (foundAiMeta.length > 0) {
    findings.push({
      status: 'warn',
      message: `${foundAiMeta.length}/${AI_META_NAMES.length} AI meta tags found`,
      detail: foundAiMeta.join(', '),
      hint: 'Add more AI meta tags to your <head>: <meta name="ai:summary" content="...">, <meta name="ai:content_type" content="...">, <meta name="ai:author" content="...">, etc.',
    });
    score -= 15;
  } else {
    findings.push({
      status: 'warn',
      message: 'No AI meta tags (ai:*) found',
      hint: 'Add AI meta tags to your HTML <head>: <meta name="ai:summary" content="Brief description">, <meta name="ai:content_type" content="website">, <meta name="ai:author" content="Your Name">.',
    });
    score -= 25;
  }

  const hasLlmsAlternate =
    /rel=["']alternate["'][^>]*llms\.txt/i.test(html) || /llms\.txt[^>]*rel=["']alternate["']/i.test(html);
  if (hasLlmsAlternate) {
    findings.push({ status: 'pass', message: 'rel="alternate" link to llms.txt present' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No rel="alternate" link to llms.txt in HTML',
      hint: 'Add to your <head>: <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-optimized content">',
    });
    score -= 15;
  }

  const hasAgentAlternate =
    /rel=["']alternate["'][^>]*agent\.json/i.test(html) || /agent\.json[^>]*rel=["']alternate["']/i.test(html);
  if (hasAgentAlternate) {
    findings.push({ status: 'pass', message: 'rel="alternate" link to agent.json present' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No rel="alternate" link to agent.json in HTML',
      hint: 'Add to your <head>: <link rel="alternate" type="application/json" href="/.well-known/agent.json" title="Agent Card">',
    });
    score -= 10;
  }

  const relMePattern = /rel=["']me["']/gi;
  const relMeCount = (html.match(relMePattern) || []).length;
  if (relMeCount >= 3) {
    findings.push({ status: 'pass', message: `${relMeCount} rel="me" identity link(s) found` });
  } else if (relMeCount > 0) {
    findings.push({ status: 'pass', message: `${relMeCount} rel="me" identity link(s) found` });
  } else {
    findings.push({
      status: 'warn',
      message: 'No rel="me" identity links found',
      hint: 'Add rel="me" links to verify your identity across platforms: <link rel="me" href="https://github.com/yourname">, <link rel="me" href="https://twitter.com/yourname">.',
    });
    score -= 10;
  }

  const hasOg = /<meta\s+[^>]*property=["']og:/i.test(html);
  if (hasOg) {
    findings.push({ status: 'pass', message: 'OpenGraph meta tags present' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No OpenGraph meta tags found',
      hint: 'Add OpenGraph meta tags for better social and AI sharing: <meta property="og:title" content="...">, <meta property="og:description" content="...">, <meta property="og:url" content="...">.',
    });
    score -= 10;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

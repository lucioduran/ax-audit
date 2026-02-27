import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'structured-data',
  name: 'Structured Data',
  description: 'Checks JSON-LD structured data on homepage',
  weight: 13,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const html = ctx.html;
  if (!html) {
    findings.push({ status: 'fail', message: 'Could not fetch homepage HTML' });
    return buildResult(meta, 0, findings, start);
  }

  const jsonLdPattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [...html.matchAll(jsonLdPattern)];

  if (blocks.length === 0) {
    findings.push({
      status: 'fail',
      message: 'No JSON-LD structured data found',
      hint: 'Add a <script type="application/ld+json"> block in your HTML <head> with schema.org structured data describing your site, organization, or person.',
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: `${blocks.length} JSON-LD block(s) found` });

  const parsed: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const raw = unescapeHtml(block[1]);
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      findings.push({
        status: 'warn',
        message: 'Invalid JSON in a JSON-LD block',
        hint: 'Validate your JSON-LD syntax. Check for trailing commas, missing quotes, or unescaped characters. Use https://validator.schema.org/ to test.',
      });
      score -= 10;
    }
  }

  if (parsed.length === 0) {
    findings.push({
      status: 'fail',
      message: 'All JSON-LD blocks have invalid JSON',
      hint: 'Fix the JSON syntax errors in your JSON-LD blocks. Use a JSON linter or https://validator.schema.org/ to validate.',
    });
    return buildResult(meta, 10, findings, start);
  }

  const hasContext = parsed.some((d) => isSchemaOrgContext(d['@context']));
  if (hasContext) {
    findings.push({ status: 'pass', message: '@context references schema.org' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No @context referencing schema.org',
      hint: 'Add "@context": "https://schema.org" to your JSON-LD root object.',
    });
    score -= 15;
  }

  const hasGraph = parsed.some((d) => Array.isArray(d['@graph']));
  if (hasGraph) {
    findings.push({ status: 'pass', message: '@graph array present (multi-entity structured data)' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No @graph array (single-entity only)',
      hint: 'Use an @graph array to define multiple entities in one JSON-LD block: { "@context": "https://schema.org", "@graph": [...] }',
    });
    score -= 5;
  }

  const allTypes = new Set<string>();
  for (const d of parsed) {
    collectTypes(d, allTypes);
  }

  const importantTypes = ['Person', 'Organization', 'WebSite', 'WebPage', 'ProfilePage'];
  const foundTypes = importantTypes.filter((t) => allTypes.has(t));

  if (foundTypes.length >= 2) {
    findings.push({ status: 'pass', message: `Key types found: ${foundTypes.join(', ')}` });
  } else if (foundTypes.length === 1) {
    findings.push({
      status: 'warn',
      message: `Only 1 key type found: ${foundTypes[0]}`,
      detail: `Consider adding: ${importantTypes.filter((t) => !allTypes.has(t)).join(', ')}`,
      hint: 'Add more entity types to your @graph. AI agents use these to understand site structure. Common types: Person, Organization, WebSite, WebPage.',
    });
    score -= 10;
  } else {
    findings.push({
      status: 'warn',
      message: 'No key entity types (Person, Organization, WebSite, etc.)',
      hint: 'Add @type to your JSON-LD entities. Use Person or Organization for the owner, WebSite for the site, and WebPage for individual pages.',
    });
    score -= 15;
  }

  if (allTypes.has('BreadcrumbList')) {
    findings.push({ status: 'pass', message: 'BreadcrumbList present' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No BreadcrumbList found',
      hint: 'Add a BreadcrumbList entity to help AI agents understand your site navigation hierarchy.',
    });
    score -= 5;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function isSchemaOrgContext(context: unknown): boolean {
  if (typeof context === 'string') {
    return /^https?:\/\/schema\.org\/?$/.test(context);
  }
  if (Array.isArray(context)) {
    return context.some((item) => isSchemaOrgContext(item));
  }
  if (context && typeof context === 'object') {
    const record = context as Record<string, unknown>;
    if (typeof record['@vocab'] === 'string') {
      return /^https?:\/\/schema\.org\/?$/.test(record['@vocab']);
    }
  }
  return false;
}

function collectTypes(obj: unknown, types: Set<string>, depth = 0): void {
  if (!obj || typeof obj !== 'object' || depth > 10) return;

  if (Array.isArray(obj)) {
    obj.forEach((item) => collectTypes(item, types, depth + 1));
    return;
  }

  const record = obj as Record<string, unknown>;
  if (record['@type']) {
    const t = Array.isArray(record['@type']) ? (record['@type'] as string[]) : [record['@type'] as string];
    t.forEach((type) => types.add(type));
  }

  if (Array.isArray(record['@graph'])) {
    (record['@graph'] as unknown[]).forEach((item) => collectTypes(item, types, depth + 1));
  }

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith('@')) continue;
    if (value && typeof value === 'object') {
      collectTypes(value, types, depth + 1);
    }
  }
}

export const meta = {
  id: 'structured-data',
  name: 'Structured Data',
  description: 'Checks JSON-LD structured data on homepage',
  weight: 15,
};

export default async function check(ctx) {
  const start = performance.now();
  const findings = [];
  let score = 100;

  const html = ctx.html;
  if (!html) {
    findings.push({ status: 'fail', message: 'Could not fetch homepage HTML' });
    return result(0, findings, start);
  }

  // Extract JSON-LD blocks
  const jsonLdPattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [...html.matchAll(jsonLdPattern)];

  if (blocks.length === 0) {
    findings.push({ status: 'fail', message: 'No JSON-LD structured data found' });
    return result(0, findings, start);
  }

  findings.push({ status: 'pass', message: `${blocks.length} JSON-LD block(s) found` });

  // Parse all blocks (unescape HTML entities first — common in SSR frameworks)
  const parsed = [];
  for (const block of blocks) {
    const raw = unescapeHtml(block[1]);
    try {
      parsed.push(JSON.parse(raw));
    } catch {
      findings.push({ status: 'warn', message: 'Invalid JSON in a JSON-LD block' });
      score -= 10;
    }
  }

  if (parsed.length === 0) {
    findings.push({ status: 'fail', message: 'All JSON-LD blocks have invalid JSON' });
    return result(10, findings, start);
  }

  // Check for @context schema.org
  const hasContext = parsed.some(d => {
    const ctx = d['@context'];
    return ctx && (ctx === 'https://schema.org' || ctx === 'https://schema.org/' || ctx === 'http://schema.org');
  });
  if (hasContext) {
    findings.push({ status: 'pass', message: '@context references schema.org' });
  } else {
    findings.push({ status: 'warn', message: 'No @context referencing schema.org' });
    score -= 15;
  }

  // Check for @graph (multi-entity pattern)
  const hasGraph = parsed.some(d => Array.isArray(d['@graph']));
  if (hasGraph) {
    findings.push({ status: 'pass', message: '@graph array present (multi-entity structured data)' });
  } else {
    findings.push({ status: 'warn', message: 'No @graph array (single-entity only)' });
    score -= 5;
  }

  // Collect all types
  const allTypes = new Set();
  for (const d of parsed) {
    collectTypes(d, allTypes);
  }

  // Key types for AI agents
  const importantTypes = ['Person', 'Organization', 'WebSite', 'WebPage', 'ProfilePage'];
  const foundTypes = importantTypes.filter(t => allTypes.has(t));

  if (foundTypes.length >= 2) {
    findings.push({ status: 'pass', message: `Key types found: ${foundTypes.join(', ')}` });
  } else if (foundTypes.length === 1) {
    findings.push({ status: 'warn', message: `Only 1 key type found: ${foundTypes[0]}`, detail: `Consider adding: ${importantTypes.filter(t => !allTypes.has(t)).join(', ')}` });
    score -= 10;
  } else {
    findings.push({ status: 'warn', message: 'No key entity types (Person, Organization, WebSite, etc.)' });
    score -= 15;
  }

  // BreadcrumbList
  if (allTypes.has('BreadcrumbList')) {
    findings.push({ status: 'pass', message: 'BreadcrumbList present' });
  } else {
    findings.push({ status: 'warn', message: 'No BreadcrumbList found' });
    score -= 5;
  }

  return result(Math.max(0, score), findings, start);
}

function unescapeHtml(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

function collectTypes(obj, types) {
  if (!obj || typeof obj !== 'object') return;
  if (obj['@type']) {
    const t = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
    t.forEach(type => types.add(type));
  }
  if (Array.isArray(obj['@graph'])) {
    obj['@graph'].forEach(item => collectTypes(item, types));
  }
  if (Array.isArray(obj)) {
    obj.forEach(item => collectTypes(item, types));
  }
}

function result(score, findings, start) {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}

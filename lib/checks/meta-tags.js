export const meta = {
  id: 'meta-tags',
  name: 'Meta Tags',
  description: 'Checks AI meta tags, rel="alternate", and rel="me" links',
  weight: 10,
};

const AI_META_NAMES = ['ai:summary', 'ai:content_type', 'ai:author', 'ai:api', 'ai:agent_card'];

export default async function check(ctx) {
  const start = performance.now();
  const findings = [];
  let score = 100;

  const html = ctx.html;
  if (!html) {
    findings.push({ status: 'fail', message: 'Could not fetch homepage HTML' });
    return result(0, findings, start);
  }

  // AI meta tags (ai:*)
  const foundAiMeta = AI_META_NAMES.filter(name => {
    const pattern = new RegExp(`<meta\\s+[^>]*name=["']${escapeRegex(name)}["'][^>]*>`, 'i');
    return pattern.test(html);
  });

  if (foundAiMeta.length >= 3) {
    findings.push({ status: 'pass', message: `${foundAiMeta.length}/${AI_META_NAMES.length} AI meta tags found`, detail: foundAiMeta.join(', ') });
  } else if (foundAiMeta.length > 0) {
    findings.push({ status: 'warn', message: `${foundAiMeta.length}/${AI_META_NAMES.length} AI meta tags found`, detail: foundAiMeta.join(', ') });
    score -= 15;
  } else {
    findings.push({ status: 'warn', message: 'No AI meta tags (ai:*) found' });
    score -= 25;
  }

  // rel="alternate" to llms.txt
  const hasLlmsAlternate = /rel=["']alternate["'][^>]*llms\.txt/i.test(html) ||
    /llms\.txt[^>]*rel=["']alternate["']/i.test(html);
  if (hasLlmsAlternate) {
    findings.push({ status: 'pass', message: 'rel="alternate" link to llms.txt present' });
  } else {
    findings.push({ status: 'warn', message: 'No rel="alternate" link to llms.txt in HTML' });
    score -= 15;
  }

  // rel="alternate" to agent.json
  const hasAgentAlternate = /rel=["']alternate["'][^>]*agent\.json/i.test(html) ||
    /agent\.json[^>]*rel=["']alternate["']/i.test(html);
  if (hasAgentAlternate) {
    findings.push({ status: 'pass', message: 'rel="alternate" link to agent.json present' });
  } else {
    findings.push({ status: 'warn', message: 'No rel="alternate" link to agent.json in HTML' });
    score -= 10;
  }

  // rel="me" identity links
  const relMePattern = /rel=["']me["']/gi;
  const relMeCount = (html.match(relMePattern) || []).length;
  if (relMeCount >= 3) {
    findings.push({ status: 'pass', message: `${relMeCount} rel="me" identity link(s) found` });
  } else if (relMeCount > 0) {
    findings.push({ status: 'pass', message: `${relMeCount} rel="me" identity link(s) found` });
  } else {
    findings.push({ status: 'warn', message: 'No rel="me" identity links found' });
    score -= 10;
  }

  // OpenGraph basics
  const hasOg = /<meta\s+[^>]*property=["']og:/i.test(html);
  if (hasOg) {
    findings.push({ status: 'pass', message: 'OpenGraph meta tags present' });
  } else {
    findings.push({ status: 'warn', message: 'No OpenGraph meta tags found' });
    score -= 10;
  }

  return result(Math.max(0, score), findings, start);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function result(score, findings, start) {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}

export const meta = {
  id: 'llms-txt',
  name: 'LLMs.txt',
  description: 'Checks /llms.txt presence and spec compliance',
  weight: 15,
};

export default async function check(ctx) {
  const start = performance.now();
  const findings = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/llms.txt`);

  if (!res.ok) {
    findings.push({ status: 'fail', message: '/llms.txt not found', detail: `HTTP ${res.status || 'network error'}` });
    return result(0, findings, start);
  }

  findings.push({ status: 'pass', message: '/llms.txt exists' });
  const text = res.body;

  // H1 heading (first non-empty line should start with "# ")
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines[0]?.startsWith('# ')) {
    findings.push({ status: 'warn', message: 'Missing H1 heading (first line should start with "# ")' });
    score -= 15;
  } else {
    findings.push({ status: 'pass', message: `H1 heading: "${lines[0].slice(2)}"` });
  }

  // Blockquote description ("> ")
  const hasBlockquote = lines.some(l => l.startsWith('> '));
  if (!hasBlockquote) {
    findings.push({ status: 'warn', message: 'No blockquote description found ("> ...")' });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: 'Blockquote description present' });
  }

  // Section headings ("## ")
  const sections = lines.filter(l => l.startsWith('## '));
  if (sections.length === 0) {
    findings.push({ status: 'warn', message: 'No section headings found (## ...)' });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: `${sections.length} section heading(s) found` });
  }

  // Markdown links [text](url)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const links = [...text.matchAll(linkPattern)];
  if (links.length === 0) {
    findings.push({ status: 'warn', message: 'No Markdown links found' });
    score -= 10;
  } else {
    findings.push({ status: 'pass', message: `${links.length} link(s) found` });
  }

  // Content substance
  if (text.length < 100) {
    findings.push({ status: 'warn', message: 'Content appears minimal (< 100 characters)' });
    score -= 10;
  }

  // Bonus: /llms-full.txt
  const fullRes = await ctx.fetch(`${ctx.url}/llms-full.txt`);
  if (fullRes.ok) {
    findings.push({ status: 'pass', message: '/llms-full.txt also available (bonus)' });
    score = Math.min(100, score + 10);
  } else {
    findings.push({ status: 'warn', message: '/llms-full.txt not found (optional but recommended)' });
  }

  return result(Math.max(0, score), findings, start);
}

function result(score, findings, start) {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}

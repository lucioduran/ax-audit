import { ALL_AI_CRAWLERS, CORE_AI_CRAWLERS } from '../constants.js';
import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';

export const meta: CheckMeta = {
  id: 'robots-txt',
  name: 'Robots.txt',
  description: 'Checks AI crawler configuration in robots.txt',
  weight: 15,
};

interface BotEntry {
  name: string;
  disallowed: boolean;
}

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/robots.txt`);

  if (!res.ok) {
    findings.push({ status: 'fail', message: '/robots.txt not found' });
    return build(0, findings, start);
  }

  findings.push({ status: 'pass', message: '/robots.txt exists' });
  const text = res.body;
  const configuredBots = parseUserAgents(text);

  const coreConfigured = CORE_AI_CRAWLERS.filter(bot =>
    configuredBots.some(b => b.name.toLowerCase() === bot.toLowerCase())
  );
  const coreMissing = CORE_AI_CRAWLERS.filter(bot =>
    !configuredBots.some(b => b.name.toLowerCase() === bot.toLowerCase())
  );

  if (coreConfigured.length === CORE_AI_CRAWLERS.length) {
    findings.push({ status: 'pass', message: `All ${CORE_AI_CRAWLERS.length} core AI crawlers explicitly configured` });
  } else if (coreConfigured.length > 0) {
    findings.push({ status: 'warn', message: `${coreConfigured.length}/${CORE_AI_CRAWLERS.length} core AI crawlers configured`, detail: `Missing: ${coreMissing.join(', ')}` });
    score -= Math.round((coreMissing.length / CORE_AI_CRAWLERS.length) * 30);
  } else {
    findings.push({ status: 'fail', message: 'No core AI crawlers explicitly configured', detail: `Expected: ${CORE_AI_CRAWLERS.join(', ')}` });
    score -= 40;
  }

  const blockedBots = configuredBots.filter(b =>
    ALL_AI_CRAWLERS.some(ai => ai.toLowerCase() === b.name.toLowerCase()) && b.disallowed
  );
  if (blockedBots.length > 0) {
    findings.push({ status: 'warn', message: `${blockedBots.length} AI crawler(s) explicitly blocked`, detail: blockedBots.map(b => b.name).join(', ') });
    score -= blockedBots.length * 3;
  }

  if (/^Sitemap:/mi.test(text)) {
    findings.push({ status: 'pass', message: 'Sitemap directive present' });
  } else {
    findings.push({ status: 'warn', message: 'No Sitemap directive found' });
    score -= 5;
  }

  const totalConfigured = ALL_AI_CRAWLERS.filter(bot =>
    configuredBots.some(b => b.name.toLowerCase() === bot.toLowerCase())
  );
  findings.push({
    status: totalConfigured.length >= 10 ? 'pass' : 'warn',
    message: `${totalConfigured.length}/${ALL_AI_CRAWLERS.length} known AI crawlers have explicit rules`,
  });

  return build(Math.max(0, Math.min(100, score)), findings, start);
}

function parseUserAgents(text: string): BotEntry[] {
  const blocks: BotEntry[] = [];
  let current: BotEntry | null = null;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    const uaMatch = trimmed.match(/^User-agent:\s*(.+)/i);
    if (uaMatch) {
      current = { name: uaMatch[1].trim(), disallowed: false };
      blocks.push(current);
    } else if (current && /^Disallow:\s*\/\s*$/i.test(trimmed)) {
      current.disallowed = true;
    }
  }
  return blocks;
}

function build(score: number, findings: Finding[], start: number): CheckResult {
  return { id: meta.id, name: meta.name, description: meta.description, score, findings, duration: Math.round(performance.now() - start) };
}

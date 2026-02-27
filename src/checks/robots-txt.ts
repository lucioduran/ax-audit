import { ALL_AI_CRAWLERS, CORE_AI_CRAWLERS } from '../constants.js';
import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'robots-txt',
  name: 'Robots.txt',
  description: 'Checks AI crawler configuration in robots.txt',
  weight: 15,
};

interface BotEntry {
  name: string;
  disallowed: boolean;
  hasRestrictions: boolean;
  hasAllow: boolean;
}

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/robots.txt`);

  if (!res.ok) {
    findings.push({
      status: 'fail',
      message: '/robots.txt not found',
      hint: 'Create a /robots.txt file at your site root. Add User-agent entries for AI crawlers (GPTBot, ClaudeBot, etc.) with Allow: / to grant access.',
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/robots.txt exists' });
  const text = res.body;
  const configuredBots = parseUserAgents(text);
  const wildcardEntry = configuredBots.find((b) => b.name === '*');

  const coreConfigured = CORE_AI_CRAWLERS.filter((bot) =>
    configuredBots.some((b) => b.name.toLowerCase() === bot.toLowerCase()),
  );
  const coreMissing = CORE_AI_CRAWLERS.filter(
    (bot) => !configuredBots.some((b) => b.name.toLowerCase() === bot.toLowerCase()),
  );

  if (coreConfigured.length === CORE_AI_CRAWLERS.length) {
    findings.push({ status: 'pass', message: `All ${CORE_AI_CRAWLERS.length} core AI crawlers explicitly configured` });
  } else if (coreConfigured.length > 0) {
    findings.push({
      status: 'warn',
      message: `${coreConfigured.length}/${CORE_AI_CRAWLERS.length} core AI crawlers configured`,
      detail: `Missing: ${coreMissing.join(', ')}`,
      hint: `Add explicit User-agent entries for the missing crawlers with Allow: / for each one.`,
    });
    score -= Math.round((coreMissing.length / CORE_AI_CRAWLERS.length) * 30);
  } else {
    findings.push({
      status: 'fail',
      message: 'No core AI crawlers explicitly configured',
      detail: `Expected: ${CORE_AI_CRAWLERS.join(', ')}`,
      hint: 'Add User-agent entries for core AI crawlers in your robots.txt. For each crawler, add: User-agent: <name> followed by Allow: / on the next line.',
    });
    score -= 40;
  }

  // Check wildcard blocking unconfigured AI crawlers
  if (wildcardEntry?.disallowed) {
    const blockedByWildcard = CORE_AI_CRAWLERS.filter(
      (bot) => !configuredBots.some((b) => b.name.toLowerCase() === bot.toLowerCase()),
    );
    if (blockedByWildcard.length > 0) {
      findings.push({
        status: 'warn',
        message: `${blockedByWildcard.length} core AI crawler(s) blocked via wildcard User-agent: *`,
        detail: blockedByWildcard.join(', '),
        hint: 'Your "User-agent: * / Disallow: /" rule blocks these crawlers. Add explicit User-agent entries with Allow: / for each AI crawler you want to permit.',
      });
      score -= blockedByWildcard.length * 5;
    }
  }

  const blockedBots = configuredBots.filter(
    (b) => b.name !== '*' && ALL_AI_CRAWLERS.some((ai) => ai.toLowerCase() === b.name.toLowerCase()) && b.disallowed,
  );
  if (blockedBots.length > 0) {
    findings.push({
      status: 'warn',
      message: `${blockedBots.length} AI crawler(s) explicitly blocked`,
      detail: blockedBots.map((b) => b.name).join(', '),
      hint: 'These crawlers have "Disallow: /" rules. If you want AI agents to access your site, change to "Allow: /" for each blocked crawler.',
    });
    score -= blockedBots.length * 3;
  }

  // Check partial restrictions (Disallow on specific paths, not full block)
  const restrictedBots = configuredBots.filter(
    (b) =>
      b.name !== '*' &&
      ALL_AI_CRAWLERS.some((ai) => ai.toLowerCase() === b.name.toLowerCase()) &&
      b.hasRestrictions &&
      !b.disallowed,
  );
  if (restrictedBots.length > 0) {
    findings.push({
      status: 'warn',
      message: `${restrictedBots.length} AI crawler(s) have partial path restrictions`,
      detail: restrictedBots.map((b) => b.name).join(', '),
      hint: 'These crawlers have Disallow rules on specific paths. For full AI access, use only "Allow: /" and let the wildcard User-agent: * handle path restrictions.',
    });
  }

  if (/^Sitemap:/im.test(text)) {
    findings.push({ status: 'pass', message: 'Sitemap directive present' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No Sitemap directive found',
      hint: 'Add a Sitemap directive to your robots.txt: Sitemap: https://your-site.com/sitemap.xml',
    });
    score -= 5;
  }

  const totalConfigured = ALL_AI_CRAWLERS.filter((bot) =>
    configuredBots.some((b) => b.name.toLowerCase() === bot.toLowerCase()),
  );
  findings.push({
    status: totalConfigured.length >= 10 ? 'pass' : 'warn',
    message: `${totalConfigured.length}/${ALL_AI_CRAWLERS.length} known AI crawlers have explicit rules`,
    ...(totalConfigured.length < 10
      ? { hint: 'Add explicit User-agent entries for more AI crawlers to maximize discoverability.' }
      : {}),
  });

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

function parseUserAgents(text: string): BotEntry[] {
  const entries: BotEntry[] = [];
  let currentGroup: BotEntry[] = [];
  let inDirectives = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const uaMatch = trimmed.match(/^User-agent:\s*(.+)/i);
    if (uaMatch) {
      if (inDirectives) {
        currentGroup = [];
        inDirectives = false;
      }
      const entry: BotEntry = { name: uaMatch[1].trim(), disallowed: false, hasRestrictions: false, hasAllow: false };
      currentGroup.push(entry);
      entries.push(entry);
    } else if (/^Disallow:\s*\/\s*$/i.test(trimmed)) {
      inDirectives = true;
      for (const entry of currentGroup) {
        entry.disallowed = true;
        entry.hasRestrictions = true;
      }
    } else if (/^Disallow:\s*\/.+/i.test(trimmed)) {
      inDirectives = true;
      for (const entry of currentGroup) {
        entry.hasRestrictions = true;
      }
    } else if (/^Allow:/i.test(trimmed)) {
      inDirectives = true;
      for (const entry of currentGroup) {
        entry.hasAllow = true;
      }
    } else if (/^(Sitemap|Crawl-delay|Host):/i.test(trimmed)) {
      inDirectives = true;
    }
  }

  return entries;
}

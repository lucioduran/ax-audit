import { guideUrl } from '../guide-urls.js';
import type { CheckContext, CheckResult, CheckMeta, Finding, FetchResponse } from '../types.js';
import { buildResult } from './utils.js';

/**
 * "well-known-ai" — emerging AI-specific discovery files that don't have a settled spec yet
 * but are already published by some sites and read by some agents. Each file present is a
 * positive signal (bonus); none of them are individually required, so a site that publishes
 * just one or two should not be punished. The score reflects coverage of this small bundle.
 *
 * Files probed:
 * - `/.well-known/ai.txt` (Spawning AI — opt-in/opt-out for AI training)
 * - `/.well-known/genai.txt` (proposed — generative AI policy)
 * - `/ai-plugin.json` and `/.well-known/ai-plugin.json` (legacy ChatGPT plugin manifest)
 * - `/agents.json` (Wildcard / OpenAgents — emerging agent capability manifest)
 * - `/.well-known/nlweb.json` (Microsoft NLWeb — natural-language site interface)
 */
export const meta: CheckMeta = {
  id: 'well-known-ai',
  name: 'AI Well-Known',
  description: 'Checks emerging AI-specific discovery files (ai.txt, agents.json, ai-plugin.json, nlweb)',
  weight: 3,
};

interface Probe {
  paths: string[];
  label: string;
  hint: string;
  guideAnchor: string;
  parser?: (body: string) => boolean;
}

const PROBES: Probe[] = [
  {
    paths: ['/.well-known/ai.txt'],
    label: 'ai.txt',
    hint: 'Publish /.well-known/ai.txt declaring opt-in/opt-out signals for AI training. See https://site.spawning.ai/spawning-ai-txt for the format.',
    guideAnchor: 'ai-txt',
  },
  {
    paths: ['/.well-known/genai.txt'],
    label: 'genai.txt',
    hint: 'Publish /.well-known/genai.txt declaring your generative-AI usage policy.',
    guideAnchor: 'genai-txt',
  },
  {
    paths: ['/.well-known/ai-plugin.json', '/ai-plugin.json'],
    label: 'ai-plugin.json',
    hint: 'Publish /ai-plugin.json (legacy ChatGPT plugin manifest). Schema: name_for_model, description_for_model, api.url. Still consumed by some agents.',
    guideAnchor: 'ai-plugin',
    parser: (body) => {
      try {
        const data = JSON.parse(body) as Record<string, unknown>;
        return Boolean(data.name_for_model || data.name_for_human || data.schema_version);
      } catch {
        return false;
      }
    },
  },
  {
    paths: ['/agents.json', '/.well-known/agents.json'],
    label: 'agents.json',
    hint: 'Publish /agents.json describing your site as a callable agent (OpenAgents / Wildcard emerging spec). Includes name, description, and operations[].',
    guideAnchor: 'agents-json',
    parser: (body) => {
      try {
        const data = JSON.parse(body) as Record<string, unknown>;
        return Boolean(data.name || data.operations || data.agents);
      } catch {
        return false;
      }
    },
  },
  {
    paths: ['/.well-known/nlweb.json', '/nlweb.json'],
    label: 'nlweb.json',
    hint: 'Publish /.well-known/nlweb.json (Microsoft NLWeb) so agents can interact with the site through a natural-language interface.',
    guideAnchor: 'nlweb',
    parser: (body) => {
      try {
        JSON.parse(body);
        return true;
      } catch {
        return false;
      }
    },
  },
];

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let presentCount = 0;

  for (const probe of PROBES) {
    let hit: { path: string; res: FetchResponse } | null = null;
    for (const path of probe.paths) {
      const res = await ctx.fetch(`${ctx.url}${path}`);
      if (res.ok && res.body.trim().length > 0) {
        hit = { path, res };
        break;
      }
    }

    if (!hit) {
      findings.push({
        status: 'warn',
        message: `${probe.label} not found`,
        detail: `Tried: ${probe.paths.join(', ')}`,
        hint: probe.hint,
        learnMoreUrl: guideUrl(meta.id, probe.guideAnchor),
      });
      continue;
    }

    if (probe.parser && !probe.parser(hit.res.body)) {
      findings.push({
        status: 'warn',
        message: `${probe.label} present at ${hit.path} but does not look valid`,
        hint: probe.hint,
        learnMoreUrl: guideUrl(meta.id, `${probe.guideAnchor}-invalid`),
      });
      continue;
    }

    presentCount++;
    findings.push({ status: 'pass', message: `${probe.label} present at ${hit.path}` });
  }

  const score = Math.round((presentCount / PROBES.length) * 100);
  findings.unshift({
    status: presentCount > 0 ? 'pass' : 'warn',
    message: `${presentCount}/${PROBES.length} emerging AI discovery files published`,
  });

  return buildResult(meta, score, findings, start);
}

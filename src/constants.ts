import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Grade, SecurityHeader } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export const VERSION: string = pkg.version;
export const USER_AGENT = `ax-audit/${pkg.version} (https://github.com/lucioduran/ax-audit)`;

export const AI_CRAWLERS: Record<string, string[]> = {
  training: [
    'GPTBot', 'ClaudeBot', 'Claude-Web', 'Anthropic-AI',
    'Google-Extended', 'CCBot', 'Bytespider',
    'Meta-ExternalAgent', 'Meta-ExternalFetcher',
    'Cohere-AI', 'cohere-training-data-crawler',
    'Applebot-Extended', 'Amazonbot', 'AI2Bot', 'AI2Bot-Dolma',
    'DeepSeek-AI', 'PanguBot', 'Diffbot',
  ],
  search: [
    'OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User',
    'PerplexityBot', 'Perplexity-User', 'DuckAssistBot', 'YouBot',
    'Petalbot', 'Google-CloudVertexBot', 'Gemini',
  ],
  fetching: [
    'FirecrawlAgent', 'Facebookbot',
  ],
};

export const ALL_AI_CRAWLERS: string[] = [
  ...AI_CRAWLERS.training,
  ...AI_CRAWLERS.search,
  ...AI_CRAWLERS.fetching,
];

export const CORE_AI_CRAWLERS: string[] = [
  'GPTBot', 'ClaudeBot', 'ChatGPT-User', 'Claude-SearchBot',
  'Google-Extended', 'PerplexityBot',
];

export const CHECK_WEIGHTS: Record<string, number> = {
  'llms-txt': 15,
  'robots-txt': 15,
  'structured-data': 15,
  'http-headers': 15,
  'agent-json': 10,
  'security-txt': 10,
  'meta-tags': 10,
  'openapi': 10,
};

export const GRADES: Grade[] = [
  { min: 90, label: 'Excellent', color: 'green' },
  { min: 70, label: 'Good', color: 'yellow' },
  { min: 50, label: 'Fair', color: 'orange' },
  { min: 0, label: 'Poor', color: 'red' },
];

export const AGENT_JSON_REQUIRED_FIELDS: string[] = ['name', 'description', 'url', 'skills'];

export const SECURITY_TXT_REQUIRED_FIELDS: string[] = ['Contact', 'Expires'];

export const SECURITY_HEADERS: SecurityHeader[] = [
  { name: 'strict-transport-security', label: 'Strict-Transport-Security', critical: true },
  { name: 'x-content-type-options', label: 'X-Content-Type-Options', critical: true },
  { name: 'x-frame-options', label: 'X-Frame-Options', critical: false },
  { name: 'x-xss-protection', label: 'X-XSS-Protection', critical: false },
  { name: 'referrer-policy', label: 'Referrer-Policy', critical: false },
  { name: 'permissions-policy', label: 'Permissions-Policy', critical: false },
  { name: 'content-security-policy', label: 'Content-Security-Policy', critical: false },
];

# ax-audit

[![CI](https://github.com/lucioduran/ax-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/lucioduran/ax-audit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ax-audit.svg)](https://www.npmjs.com/package/ax-audit)
[![license](https://img.shields.io/npm/l/ax-audit.svg)](https://github.com/lucioduran/ax-audit/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/ax-audit.svg)](https://nodejs.org)

**Lighthouse for AI Agents.** Audit any website's AI Agent Experience (AX) readiness in seconds.

```bash
npx ax-audit https://your-site.com
```

```
  AX Audit Report
  https://lucioduran.com

  ███████████████████████████████████████░  98/100  Excellent

  LLMs.txt (100/100)
    PASS  /llms.txt exists
    PASS  H1 heading: "Lucio Duran — Personal Portfolio"
    PASS  /llms-full.txt also available (bonus)

  Robots.txt (100/100)
    PASS  All 6 core AI crawlers explicitly configured
    PASS  31/31 known AI crawlers have explicit rules
  ...
```

## Why

AI agents and LLMs are increasingly crawling, indexing, and interacting with websites. Just like Lighthouse audits web performance and axe-core audits accessibility, **ax-audit** tells you how ready your site is for the AI agent ecosystem.

## What it checks

| Check | What it audits | Weight |
|---|---|---|
| **LLMs.txt** | `/llms.txt` presence and [llmstxt.org](https://llmstxt.org) spec compliance | 15% |
| **Robots.txt** | AI crawler configuration, wildcard detection, partial path restrictions | 15% |
| **Structured Data** | JSON-LD on homepage (schema.org, `@graph`, entity types) | 15% |
| **HTTP Headers** | Security headers + AI discovery `Link` headers + CORS on `.well-known` | 15% |
| **Agent Card** | `/.well-known/agent.json` [A2A protocol](https://a2a-protocol.org) compliance | 10% |
| **Security.txt** | `/.well-known/security.txt` [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) compliance | 10% |
| **Meta Tags** | AI meta tags (`ai:*`), `rel="alternate"` to llms.txt, `rel="me"` identity links | 10% |
| **OpenAPI** | `/.well-known/openapi.json` presence and schema validity | 10% |

## Install

```bash
npm install -g ax-audit
```

Or run directly without installing:

```bash
npx ax-audit https://your-site.com
```

## Usage

```bash
# Full audit with colored terminal output
ax-audit https://example.com

# JSON output for CI/CD pipelines
ax-audit https://example.com --json

# Run only specific checks (validates IDs, errors on unknown)
ax-audit https://example.com --checks llms-txt,robots-txt,agent-json

# Custom timeout per request (default: 10s)
ax-audit https://example.com --timeout 15000

# Verbose mode — see every HTTP request, cache hit, and check score
ax-audit https://example.com --verbose
```

## Programmatic API

Full TypeScript support with exported types.

```typescript
import { audit } from 'ax-audit';

const report = await audit({ url: 'https://example.com' });

console.log(report.overallScore); // 0-100
console.log(report.grade.label);  // 'Excellent' | 'Good' | 'Fair' | 'Poor'
console.log(report.results);      // Individual check results with findings
```

## Scoring

Each check returns a score from 0 to 100. The overall score is a weighted average across all checks.

| Grade | Score | Exit Code |
|---|---|---|
| Excellent | 90 - 100 | `0` |
| Good | 70 - 89 | `0` |
| Fair | 50 - 69 | `1` |
| Poor | 0 - 49 | `1` |

Exit codes make it easy to gate CI/CD deployments on AX readiness.

## CI Integration

### GitHub Actions

```yaml
- name: AX Audit
  run: npx ax-audit https://your-site.com
  # Fails the step if score < 70
```

Save the report as an artifact:

```yaml
- name: AX Audit (JSON)
  run: npx ax-audit https://your-site.com --json > ax-report.json

- uses: actions/upload-artifact@v4
  with:
    name: ax-audit-report
    path: ax-report.json
```

## Available Checks

| Check ID | Use with `--checks` |
|---|---|
| `llms-txt` | LLMs.txt spec compliance |
| `robots-txt` | AI crawler configuration |
| `structured-data` | JSON-LD structured data |
| `http-headers` | Security + AI discovery headers |
| `agent-json` | A2A Agent Card |
| `security-txt` | RFC 9116 Security.txt |
| `meta-tags` | AI meta tags and identity links |
| `openapi` | OpenAPI specification |

## Testing

```bash
npm test
```

86 tests covering all 8 checks, the scorer, and edge cases. Uses Node.js built-in test runner (`node:test`), no extra test dependencies.

## Tech Stack

- **TypeScript** with strict mode
- **2 runtime dependencies**: `chalk` + `commander`
- **Node.js 18+** built-in `fetch` (zero HTTP libraries)
- Parallel check execution via `Promise.allSettled`
- In-memory request caching per audit run

## Contributing

Contributions are welcome. To add a new check:

1. Create `src/checks/your-check.ts` exporting `default` (async check function) and `meta` (CheckMeta)
2. Use `buildResult(meta, score, findings, start)` from `./utils.js` to return results
3. Register it in `src/checks/index.ts`
4. Add its weight to `CHECK_WEIGHTS` in `src/constants.ts`

## License

[Apache 2.0](LICENSE)

---

Built by [Lucio Duran](https://lucioduran.com)

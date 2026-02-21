# ax-audit

Audit websites for **AI Agent Experience (AX)** readiness. Lighthouse for AI Agents.

```
npx ax-audit https://example.com
```

## What it checks

| Check | Description | Weight |
|---|---|---|
| **LLMs.txt** | `/llms.txt` presence and [spec](https://llmstxt.org) compliance | 15% |
| **Robots.txt** | AI crawler configuration (GPTBot, ClaudeBot, etc.) | 15% |
| **Structured Data** | JSON-LD on homepage (schema.org, @graph, entity types) | 15% |
| **HTTP Headers** | Security headers + AI discovery Link headers + CORS | 15% |
| **Agent Card** | `/.well-known/agent.json` [A2A protocol](https://a2a-protocol.org) | 10% |
| **Security.txt** | `/.well-known/security.txt` [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) | 10% |
| **Meta Tags** | AI meta tags (`ai:*`), `rel="alternate"`, `rel="me"` | 10% |
| **OpenAPI** | `/.well-known/openapi.json` presence and validity | 10% |

## Install

```bash
npm install -g ax-audit
```

Or run directly:

```bash
npx ax-audit https://your-site.com
```

## Usage

```bash
# Terminal output (default)
ax-audit https://example.com

# JSON output (for CI pipelines)
ax-audit https://example.com --json

# Run specific checks only
ax-audit https://example.com --checks llms-txt,robots-txt,agent-json

# Custom timeout (default: 10s)
ax-audit https://example.com --timeout 15000
```

## Programmatic API

```javascript
import { audit } from 'ax-audit';

const report = await audit({ url: 'https://example.com' });
console.log(report.overallScore); // 0-100
console.log(report.grade.label);  // 'Excellent' | 'Good' | 'Fair' | 'Poor'
```

## Scoring

Each check returns a score from 0 to 100. The overall score is a weighted average.

| Grade | Score | Exit Code |
|---|---|---|
| Excellent | 90-100 | 0 |
| Good | 70-89 | 0 |
| Fair | 50-69 | 1 |
| Poor | 0-49 | 1 |

Exit codes make it easy to gate CI/CD deployments on AX readiness.

## CI Integration

### GitHub Actions

```yaml
- name: AX Audit
  run: npx ax-audit https://your-site.com --json > ax-report.json
```

## Requirements

- Node.js >= 18.0.0

## License

MIT

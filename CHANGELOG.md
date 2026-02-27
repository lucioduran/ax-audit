# Changelog

All notable changes to ax-audit are documented here.

## [2.0.0] - 2026-02-27

### Added

- **HTML reporter**: `--output html` generates a self-contained HTML report with circular score gauge, dark mode support, collapsible check sections, and responsive design
- Supports both single URL and batch reports
- Pipe to file: `ax-audit https://example.com --output html > report.html`

## [1.15.0] - 2026-02-27

### Added

- **Batch audit**: pass multiple URLs to audit them in a single run with summary table (`ax-audit url1 url2 url3`)
- **`batchAudit()` API**: programmatic batch auditing with `BatchAuditReport` type
- **CHANGELOG.md**: full project history

## [1.14.0] - 2026-02-27

### Added

- **RFC 5988 Link header parser**: proper parsing of `<url>; rel="type"` format instead of naive regex matching
- Prevents false positives from parameter values like `title="llms.txt"`

## [1.13.0] - 2026-02-27

### Fixed

- **Structured data**: `@context` now supports string, array, and `@vocab` object formats
- **Structured data**: `collectTypes()` recurses into nested entities (author, publisher, etc.) with depth limit

## [1.12.0] - 2026-02-27

### Added

- **`--only-failures` flag**: filter output to show only checks with warnings or failures

## [1.11.0] - 2026-02-27

### Added

- **MCP check**: new check for `/.well-known/mcp.json` (Model Context Protocol) server configuration (weight: 10%)
- Check weights redistributed across 9 checks: llms-txt 15%, robots-txt 15%, structured-data 13%, http-headers 13%, agent-json 10%, mcp 10%, security-txt 8%, meta-tags 8%, openapi 8%

## [1.10.0] - 2026-02-27

### Added

- **ESLint + Prettier**: code quality tooling with CI integration

## [1.9.0] - 2026-02-27

### Added

- **Public TypeScript API**: new `src/index.ts` entry point exporting `audit`, `calculateOverallScore`, `getGrade`, `checks`, and all types
- Package `exports` field pointing to `dist/index.js`

## [1.8.0] - 2026-02-27

### Added

- **`--checks` validation**: unknown check IDs now error with a list of available checks

## [1.7.0] - 2026-02-27

### Changed

- All checks refactored to use shared `buildResult()` utility from `src/checks/utils.ts`

## [1.6.0] - 2026-02-27

### Added

- **CI/CD**: GitHub Actions workflow running lint, format check, build, and tests

## [1.5.0] - 2026-02-27

### Added

- **`--verbose` flag**: detailed HTTP request, cache hit, and check execution logs

## [1.4.0] - 2026-02-27

### Added

- **97 tests**: comprehensive test suite covering all 9 checks and edge cases (Node.js built-in test runner)

## [1.3.0] - 2026-02-27

### Fixed

- **Robots.txt parser**: handles partial disallows, multi-UA blocks, wildcard detection, comment lines

## [1.2.0] - 2026-02-27

### Fixed

- **Score bounds**: all checks now clamp scores to 0-100 range

## [1.0.1] - 2025-01-15

### Changed

- Switched license from MIT to Apache 2.0
- Improved README with badges and documentation

## [1.0.0] - 2025-01-15

### Added

- Initial release of ax-audit
- 8 checks: llms-txt, robots-txt, structured-data, http-headers, agent-json, security-txt, meta-tags, openapi
- Terminal and JSON output formats
- Weighted scoring system with grades (Excellent, Good, Fair, Poor)
- CLI with `--json`, `--output`, `--timeout` flags
- TypeScript codebase with zero HTTP library dependencies

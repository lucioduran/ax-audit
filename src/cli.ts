import { Command } from 'commander';
import { audit } from './orchestrator.js';
import { report } from './reporter/index.js';
import { VERSION } from './constants.js';
import { checks as allChecks } from './checks/index.js';

export function cli(argv: string[]): void {
  const program = new Command();

  program
    .name('ax-audit')
    .description('Audit websites for AI Agent Experience (AX) readiness. Lighthouse for AI Agents.')
    .version(VERSION, '-v, --version')
    .argument('<url>', 'URL to audit (e.g., https://example.com)')
    .option('--json', 'Output results as JSON')
    .option('--output <format>', 'Output format: terminal, json', 'terminal')
    .option('--checks <list>', 'Comma-separated list of checks to run')
    .option('--timeout <ms>', 'Per-request timeout in milliseconds', '10000')
    .option('--verbose', 'Show detailed request and check execution logs')
    .action(async (url: string, options: { json?: boolean; output: string; checks?: string; timeout: string; verbose?: boolean }) => {
      try {
        new URL(url);
      } catch {
        console.error(`Error: Invalid URL "${url}". Provide a full URL like https://example.com`);
        process.exit(1);
      }

      const format = options.json ? 'json' : options.output;
      const checks = options.checks
        ? options.checks.split(',').map(s => s.trim())
        : undefined;

      if (checks) {
        const validIds = allChecks.map(c => c.meta.id);
        const invalid = checks.filter(id => !validIds.includes(id));
        if (invalid.length > 0) {
          console.error(`Error: Unknown check(s): ${invalid.join(', ')}`);
          console.error(`Available checks: ${validIds.join(', ')}`);
          process.exit(1);
        }
      }

      try {
        const result = await audit({
          url,
          checks,
          timeout: parseInt(options.timeout, 10),
          verbose: options.verbose,
        });

        report(result, format);
        process.exit(result.overallScore >= 70 ? 0 : 1);
      } catch (err: unknown) {
        const error = err as Error;
        console.error(`Fatal: ${error.message}`);
        process.exit(2);
      }
    });

  program.parse(argv);
}

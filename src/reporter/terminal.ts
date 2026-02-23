import chalk from 'chalk';
import { GRADES } from '../constants.js';
import type { AuditReport, BatchAuditReport, Grade } from '../types.js';

const STATUS_ICONS: Record<string, string> = {
  pass: chalk.green('  PASS '),
  warn: chalk.yellow('  WARN '),
  fail: chalk.red('  FAIL '),
};

function gradeColor(grade: Grade) {
  if (grade.label === 'Excellent') return chalk.green;
  if (grade.label === 'Good') return chalk.yellow;
  if (grade.label === 'Fair') return chalk.hex('#FFA500');
  return chalk.red;
}

export function reportTerminal(report: AuditReport): void {
  const grade = GRADES.find((g) => report.overallScore >= g.min) || GRADES[GRADES.length - 1];
  const colorFn = gradeColor(grade);

  console.log();
  console.log(chalk.bold('  AX Audit Report'));
  console.log(chalk.dim(`  ${report.url}`));
  console.log(chalk.dim(`  ${report.timestamp}  (${report.duration}ms)`));
  console.log();

  const barWidth = 40;
  const filled = Math.round((report.overallScore / 100) * barWidth);
  const empty = barWidth - filled;
  console.log(
    `  ${colorFn('\u2588'.repeat(filled))}${chalk.gray('\u2591'.repeat(empty))}  ${colorFn.bold(report.overallScore + '/100')}  ${colorFn(grade.label)}`,
  );
  console.log();

  for (const check of report.results) {
    console.log(chalk.bold(`  ${check.name}`) + chalk.dim(` (${check.score}/100)`));

    for (const finding of check.findings) {
      console.log(`${STATUS_ICONS[finding.status]} ${finding.message}`);
      if (finding.detail) {
        console.log(chalk.dim(`         ${finding.detail}`));
      }
    }
    console.log();
  }

  console.log(chalk.dim('  Powered by ax-audit \u2014 Lighthouse for AI Agents'));
  console.log();
}

export function reportBatchTerminal(batch: BatchAuditReport): void {
  for (const r of batch.reports) {
    reportTerminal(r);
  }

  const { summary } = batch;
  const grade = summary.grade;
  const colorFn = gradeColor(grade);

  console.log(chalk.bold('  ═══ Batch Summary ═══'));
  console.log();

  const colUrl = 40;
  const colScore = 10;
  const colGrade = 12;
  console.log(chalk.dim('  ' + 'URL'.padEnd(colUrl) + 'Score'.padStart(colScore) + 'Grade'.padStart(colGrade)));
  console.log(chalk.dim('  ' + '─'.repeat(colUrl + colScore + colGrade)));

  for (const r of batch.reports) {
    const rGrade = GRADES.find((g) => r.overallScore >= g.min) || GRADES[GRADES.length - 1];
    const rColor = gradeColor(rGrade);
    const shortUrl = r.url.length > colUrl - 2 ? r.url.slice(0, colUrl - 5) + '...' : r.url;
    console.log(
      '  ' +
        shortUrl.padEnd(colUrl) +
        rColor.bold(`${r.overallScore}/100`.padStart(colScore)) +
        rColor(rGrade.label.padStart(colGrade)),
    );
  }

  console.log();
  console.log(
    `  ${summary.total} URLs audited: ${chalk.green(`${summary.passed} passed`)}` +
      (summary.failed > 0 ? `, ${chalk.red(`${summary.failed} failed`)}` : ''),
  );

  const barWidth = 40;
  const filled = Math.round((summary.averageScore / 100) * barWidth);
  const empty = barWidth - filled;
  console.log(
    `  ${colorFn('\u2588'.repeat(filled))}${chalk.gray('\u2591'.repeat(empty))}  ${colorFn.bold(summary.averageScore + '/100')} avg  ${colorFn(grade.label)}`,
  );
  console.log(chalk.dim(`  Total duration: ${batch.duration}ms`));
  console.log();
}

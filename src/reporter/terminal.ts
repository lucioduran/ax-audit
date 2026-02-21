import chalk from 'chalk';
import { GRADES } from '../constants.js';
import type { AuditReport, Grade } from '../types.js';

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
  const grade = GRADES.find(g => report.overallScore >= g.min) || GRADES[GRADES.length - 1];
  const colorFn = gradeColor(grade);

  console.log();
  console.log(chalk.bold('  AX Audit Report'));
  console.log(chalk.dim(`  ${report.url}`));
  console.log(chalk.dim(`  ${report.timestamp}  (${report.duration}ms)`));
  console.log();

  const barWidth = 40;
  const filled = Math.round((report.overallScore / 100) * barWidth);
  const empty = barWidth - filled;
  console.log(`  ${colorFn('\u2588'.repeat(filled))}${chalk.gray('\u2591'.repeat(empty))}  ${colorFn.bold(report.overallScore + '/100')}  ${colorFn(grade.label)}`);
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

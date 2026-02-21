import { reportTerminal } from './terminal.js';
import { reportJson } from './json.js';
import type { AuditReport } from '../types.js';

export function report(auditReport: AuditReport, format: string): void {
  switch (format) {
    case 'json':
      reportJson(auditReport);
      break;
    case 'terminal':
    default:
      reportTerminal(auditReport);
      break;
  }
}

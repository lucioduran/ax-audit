import { reportTerminal, reportBatchTerminal } from './terminal.js';
import { reportJson, reportBatchJson } from './json.js';
import { reportHtml, reportBatchHtml } from './html.js';
import type { AuditReport, BatchAuditReport } from '../types.js';

export function report(auditReport: AuditReport, format: string): void {
  switch (format) {
    case 'json':
      reportJson(auditReport);
      break;
    case 'html':
      reportHtml(auditReport);
      break;
    case 'terminal':
    default:
      reportTerminal(auditReport);
      break;
  }
}

export function reportBatch(batchReport: BatchAuditReport, format: string): void {
  switch (format) {
    case 'json':
      reportBatchJson(batchReport);
      break;
    case 'html':
      reportBatchHtml(batchReport);
      break;
    case 'terminal':
    default:
      reportBatchTerminal(batchReport);
      break;
  }
}

import type { AuditReport, BatchAuditReport } from '../types.js';

export function reportJson(report: AuditReport): void {
  console.log(JSON.stringify(report, null, 2));
}

export function reportBatchJson(batch: BatchAuditReport): void {
  console.log(JSON.stringify(batch, null, 2));
}

import type { AuditReport, BaselineDiff, BatchAuditReport } from '../types.js';

export function reportJson(report: AuditReport, diff?: BaselineDiff): void {
  const output = diff ? { ...report, baselineDiff: diff } : report;
  console.log(JSON.stringify(output, null, 2));
}

export function reportBatchJson(batch: BatchAuditReport): void {
  console.log(JSON.stringify(batch, null, 2));
}

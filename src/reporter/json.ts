import type { AuditReport } from '../types.js';

export function reportJson(report: AuditReport): void {
  console.log(JSON.stringify(report, null, 2));
}

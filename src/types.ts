export type FindingStatus = 'pass' | 'warn' | 'fail';

export interface Finding {
  status: FindingStatus;
  message: string;
  detail?: string;
}

export interface CheckResult {
  id: string;
  name: string;
  description: string;
  score: number;
  findings: Finding[];
  duration: number;
}

export interface CheckMeta {
  id: string;
  name: string;
  description: string;
  weight: number;
}

export interface FetchResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
  url: string;
  error?: string;
}

export interface CheckContext {
  url: string;
  fetch: (url: string) => Promise<FetchResponse>;
  html: string;
  headers: Record<string, string>;
}

export interface CheckModule {
  run: (ctx: CheckContext) => Promise<CheckResult>;
  meta: CheckMeta;
}

export interface Grade {
  min: number;
  label: string;
  color: string;
}

export interface AuditReport {
  url: string;
  timestamp: string;
  overallScore: number;
  grade: Grade;
  results: CheckResult[];
  duration: number;
}

export interface AuditOptions {
  url: string;
  checks?: string[];
  timeout?: number;
  verbose?: boolean;
}

export interface BatchAuditReport {
  reports: AuditReport[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    averageScore: number;
    grade: Grade;
  };
  duration: number;
}

export interface SecurityHeader {
  name: string;
  label: string;
  critical: boolean;
}

import type { CheckContext, CheckResult, CheckMeta, Finding } from '../types.js';
import { buildResult } from './utils.js';

export const meta: CheckMeta = {
  id: 'mcp',
  name: 'MCP (Model Context Protocol)',
  description: 'Checks /.well-known/mcp.json presence and configuration',
  weight: 10,
};

export default async function check(ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  let score = 100;

  const res = await ctx.fetch(`${ctx.url}/.well-known/mcp.json`);

  if (!res.ok) {
    findings.push({
      status: 'fail',
      message: '/.well-known/mcp.json not found',
      detail: `HTTP ${res.status || 'network error'}`,
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/mcp.json exists' });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({ status: 'fail', message: 'Invalid JSON' });
    return buildResult(meta, 10, findings, start);
  }
  findings.push({ status: 'pass', message: 'Valid JSON' });

  // Check for server name/description
  if (data.name) {
    findings.push({ status: 'pass', message: `Server name: "${data.name}"` });
  } else {
    findings.push({ status: 'warn', message: 'Missing server name' });
    score -= 10;
  }

  if (data.description) {
    findings.push({ status: 'pass', message: 'Server description present' });
  } else {
    findings.push({ status: 'warn', message: 'Missing server description' });
    score -= 5;
  }

  // Check for tools
  if (Array.isArray(data.tools) && data.tools.length > 0) {
    findings.push({ status: 'pass', message: `${data.tools.length} tool(s) defined` });

    const toolsWithDescriptions = (data.tools as Record<string, unknown>[]).filter((t) => t.description);
    if (toolsWithDescriptions.length === data.tools.length) {
      findings.push({ status: 'pass', message: 'All tools have descriptions' });
    } else if (toolsWithDescriptions.length > 0) {
      findings.push({
        status: 'warn',
        message: `${toolsWithDescriptions.length}/${data.tools.length} tools have descriptions`,
      });
      score -= 5;
    } else {
      findings.push({ status: 'warn', message: 'No tools have descriptions' });
      score -= 10;
    }
  } else if (Array.isArray(data.tools)) {
    findings.push({ status: 'warn', message: 'Tools array is empty' });
    score -= 15;
  } else {
    findings.push({ status: 'warn', message: 'No tools array defined' });
    score -= 15;
  }

  // Check for resources
  if (Array.isArray(data.resources) && data.resources.length > 0) {
    findings.push({ status: 'pass', message: `${data.resources.length} resource(s) defined` });
  } else {
    findings.push({ status: 'warn', message: 'No resources defined' });
    score -= 5;
  }

  // Check for prompts
  if (Array.isArray(data.prompts) && data.prompts.length > 0) {
    findings.push({ status: 'pass', message: `${data.prompts.length} prompt(s) defined` });
  }

  // Check for version
  if (data.version || data.protocolVersion) {
    findings.push({
      status: 'pass',
      message: `Protocol version: ${data.protocolVersion || data.version}`,
    });
  } else {
    findings.push({ status: 'warn', message: 'No protocol version specified' });
    score -= 5;
  }

  // Check for authentication info
  if (data.authentication) {
    findings.push({ status: 'pass', message: 'Authentication configuration present' });
  }

  // Check CORS on the endpoint
  if (res.headers['access-control-allow-origin']) {
    findings.push({ status: 'pass', message: 'CORS enabled on MCP endpoint' });
  } else {
    findings.push({ status: 'warn', message: 'No CORS headers on MCP endpoint' });
    score -= 10;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

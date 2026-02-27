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
      hint: 'Create a /.well-known/mcp.json file describing your MCP server configuration. Include name, description, tools, and version fields. See https://modelcontextprotocol.io for the spec.',
    });
    return buildResult(meta, 0, findings, start);
  }

  findings.push({ status: 'pass', message: '/.well-known/mcp.json exists' });

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.body);
  } catch {
    findings.push({
      status: 'fail',
      message: 'Invalid JSON',
      hint: 'Fix the JSON syntax in your mcp.json file. Validate with a JSON linter.',
    });
    return buildResult(meta, 10, findings, start);
  }
  findings.push({ status: 'pass', message: 'Valid JSON' });

  if (data.name) {
    findings.push({ status: 'pass', message: `Server name: "${data.name}"` });
  } else {
    findings.push({
      status: 'warn',
      message: 'Missing server name',
      hint: 'Add a "name" field to your mcp.json identifying your MCP server.',
    });
    score -= 10;
  }

  if (data.description) {
    findings.push({ status: 'pass', message: 'Server description present' });
  } else {
    findings.push({
      status: 'warn',
      message: 'Missing server description',
      hint: 'Add a "description" field explaining what your MCP server does and what tools it provides.',
    });
    score -= 5;
  }

  if (Array.isArray(data.tools) && data.tools.length > 0) {
    findings.push({ status: 'pass', message: `${data.tools.length} tool(s) defined` });

    const toolsWithDescriptions = (data.tools as Record<string, unknown>[]).filter((t) => t.description);
    if (toolsWithDescriptions.length === data.tools.length) {
      findings.push({ status: 'pass', message: 'All tools have descriptions' });
    } else if (toolsWithDescriptions.length > 0) {
      findings.push({
        status: 'warn',
        message: `${toolsWithDescriptions.length}/${data.tools.length} tools have descriptions`,
        hint: 'Add a "description" field to each tool so AI agents understand what each tool does.',
      });
      score -= 5;
    } else {
      findings.push({
        status: 'warn',
        message: 'No tools have descriptions',
        hint: 'Add a "description" field to each tool in the tools array. Descriptions help AI agents decide which tool to use.',
      });
      score -= 10;
    }
  } else if (Array.isArray(data.tools)) {
    findings.push({
      status: 'warn',
      message: 'Tools array is empty',
      hint: 'Add at least one tool to the tools array with name, description, and inputSchema fields.',
    });
    score -= 15;
  } else {
    findings.push({
      status: 'warn',
      message: 'No tools array defined',
      hint: 'Add a "tools" array to your mcp.json. Each tool should have name, description, and inputSchema.',
    });
    score -= 15;
  }

  if (Array.isArray(data.resources) && data.resources.length > 0) {
    findings.push({ status: 'pass', message: `${data.resources.length} resource(s) defined` });
  } else {
    findings.push({
      status: 'warn',
      message: 'No resources defined',
      hint: 'Add a "resources" array listing the data resources your MCP server exposes to AI agents.',
    });
    score -= 5;
  }

  if (Array.isArray(data.prompts) && data.prompts.length > 0) {
    findings.push({ status: 'pass', message: `${data.prompts.length} prompt(s) defined` });
  }

  if (data.version || data.protocolVersion) {
    findings.push({
      status: 'pass',
      message: `Protocol version: ${data.protocolVersion || data.version}`,
    });
  } else {
    findings.push({
      status: 'warn',
      message: 'No protocol version specified',
      hint: 'Add a "protocolVersion" field (e.g., "2024-11-05") to declare MCP spec compatibility.',
    });
    score -= 5;
  }

  if (data.authentication) {
    findings.push({ status: 'pass', message: 'Authentication configuration present' });
  }

  if (res.headers['access-control-allow-origin']) {
    findings.push({ status: 'pass', message: 'CORS enabled on MCP endpoint' });
  } else {
    findings.push({
      status: 'warn',
      message: 'No CORS headers on MCP endpoint',
      hint: 'Add Access-Control-Allow-Origin: * to the /.well-known/mcp.json response so browser-based AI agents can fetch it.',
    });
    score -= 10;
  }

  return buildResult(meta, Math.max(0, Math.min(100, score)), findings, start);
}

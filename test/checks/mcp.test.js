import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/mcp.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('mcp', () => {
  it('should return score 0 when mcp.json is not found', async () => {
    const ctx = mockContext({});
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('not found')));
  });

  it('should return score 10 for invalid JSON', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({ body: 'not json' }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 10);
  });

  it('should score well for a fully compliant mcp.json', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({
          name: 'My MCP Server',
          description: 'A test MCP server',
          protocolVersion: '2025-03-26',
          tools: [
            { name: 'search', description: 'Search the web' },
            { name: 'fetch', description: 'Fetch a URL' },
          ],
          resources: [{ uri: 'file:///data', name: 'Data' }],
          prompts: [{ name: 'summarize', description: 'Summarize text' }],
          authentication: { type: 'bearer' },
        }),
        headers: { 'access-control-allow-origin': '*' },
      }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should penalize missing server name', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({
          description: 'A test server',
          tools: [{ name: 'test', description: 'Test tool' }],
          resources: [{ uri: 'file:///data' }],
          protocolVersion: '2025-03-26',
        }),
        headers: { 'access-control-allow-origin': '*' },
      }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.message.includes('Missing server name')));
  });

  it('should penalize empty tools array', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({
          name: 'Test',
          description: 'Test',
          tools: [],
          resources: [{ uri: 'file:///data' }],
          protocolVersion: '2025-03-26',
        }),
        headers: { 'access-control-allow-origin': '*' },
      }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.message.includes('empty')));
  });

  it('should penalize missing CORS headers', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({
          name: 'Test',
          description: 'Test',
          tools: [{ name: 'test', description: 'Test' }],
          resources: [{ uri: 'file:///data' }],
          protocolVersion: '2025-03-26',
        }),
      }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.message.includes('No CORS')));
  });

  it('should penalize missing protocol version', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({
          name: 'Test',
          description: 'Test',
          tools: [{ name: 'test', description: 'Test' }],
          resources: [{ uri: 'file:///data' }],
        }),
        headers: { 'access-control-allow-origin': '*' },
      }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.message.includes('No protocol version')));
  });

  it('should penalize tools without descriptions', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({
          name: 'Test',
          description: 'Test',
          tools: [{ name: 'test1' }, { name: 'test2' }],
          resources: [{ uri: 'file:///data' }],
          protocolVersion: '2025-03-26',
        }),
        headers: { 'access-control-allow-origin': '*' },
      }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.message.includes('No tools have descriptions')));
  });

  it('should clamp score between 0 and 100', async () => {
    const ctx = mockContext({
      '/.well-known/mcp.json': mockResponse({
        body: JSON.stringify({}),
      }),
    });
    const result = await check(ctx);
    assert.ok(result.score >= 0 && result.score <= 100);
  });
});

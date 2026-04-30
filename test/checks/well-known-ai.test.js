import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/well-known-ai.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('well-known-ai', () => {
  it('should return score 0 when no files are present', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.ok(result.findings[0].message.includes('0/'));
  });

  it('should score proportionally when one file is present', async () => {
    const ctx = mockContext({
      '/.well-known/ai.txt': mockResponse({ body: 'User-Agent: *\nAllow: /\n' }),
    });
    const result = await check(ctx);
    assert.ok(result.score > 0);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('ai.txt present')));
  });

  it('should score 100 when every probe succeeds', async () => {
    const ctx = mockContext({
      '/.well-known/ai.txt': mockResponse({ body: 'User-Agent: *\nAllow: /\n' }),
      '/.well-known/genai.txt': mockResponse({ body: 'policy text' }),
      '/.well-known/ai-plugin.json': mockResponse({ body: JSON.stringify({ schema_version: 'v1', name_for_model: 'x' }) }),
      '/agents.json': mockResponse({ body: JSON.stringify({ name: 'My agent', operations: [] }) }),
      '/.well-known/nlweb.json': mockResponse({ body: JSON.stringify({}) }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should accept ai-plugin.json at the alternate root path', async () => {
    const ctx = mockContext({
      '/ai-plugin.json': mockResponse({ body: JSON.stringify({ schema_version: 'v1', name_for_human: 'Test' }) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('ai-plugin.json')));
  });

  it('should warn when ai-plugin.json is not valid JSON', async () => {
    const ctx = mockContext({
      '/.well-known/ai-plugin.json': mockResponse({ body: 'not json{{{' }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('does not look valid')));
  });

  it('should warn when agents.json is JSON but has none of the expected fields', async () => {
    const ctx = mockContext({
      '/agents.json': mockResponse({ body: JSON.stringify({ unrelated: 1 }) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('does not look valid')));
  });

  it('should treat empty bodies as not-present', async () => {
    const ctx = mockContext({
      '/.well-known/ai.txt': mockResponse({ body: '   \n  ' }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('ai.txt not found')));
  });

  it('should clamp score within [0,100]', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.ok(result.score >= 0 && result.score <= 100);
  });
});

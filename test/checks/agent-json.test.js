import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/agent-json.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('agent-json', () => {
  it('should return score 0 when agent.json is not found', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should return score 10 for invalid JSON', async () => {
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: 'not json{{{' }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 10);
  });

  it('should score 100 for a fully compliant agent.json', async () => {
    const data = {
      name: 'My Agent',
      description: 'Does stuff',
      url: 'https://example.com',
      skills: [{ id: 'search', name: 'Search' }],
      protocolVersion: '0.2.0',
      capabilities: { streaming: true },
      authentication: { type: 'bearer' },
      documentationUrl: 'https://example.com/docs',
    };
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should penalize missing required fields', async () => {
    const data = { name: 'Agent' };
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('description')));
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('url')));
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('skills')));
  });

  it('should penalize empty skills array', async () => {
    const data = {
      name: 'Agent',
      description: 'Desc',
      url: 'https://example.com',
      skills: [],
    };
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('empty')));
  });

  it('should penalize missing protocolVersion', async () => {
    const data = {
      name: 'Agent',
      description: 'Desc',
      url: 'https://example.com',
      skills: [{ id: 'a' }],
    };
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('protocolVersion')));
  });

  it('should penalize missing optional fields', async () => {
    const data = {
      name: 'Agent',
      description: 'Desc',
      url: 'https://example.com',
      skills: [{ id: 'a' }],
      protocolVersion: '0.1.0',
    };
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('optional')));
  });

  it('should clamp score to 0 minimum', async () => {
    // All required fields missing + no optional + no protocol
    const data = {};
    const ctx = mockContext({
      '/agent.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.score >= 0);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/openapi.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('openapi', () => {
  it('should return score 0 when openapi.json is not found', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should return score 10 for invalid JSON', async () => {
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: 'not json' }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 10);
  });

  it('should score 100 for a fully compliant OpenAPI spec', async () => {
    const data = {
      openapi: '3.1.0',
      info: { title: 'My API', description: 'An API that does things' },
      paths: { '/users': { get: {} }, '/items': { get: {} } },
      servers: [{ url: 'https://api.example.com' }],
    };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should penalize Swagger version', async () => {
    const data = {
      swagger: '2.0',
      info: { title: 'My API', description: 'Desc' },
      paths: { '/users': {} },
      servers: [{ url: 'https://api.example.com' }],
    };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('Swagger')));
  });

  it('should penalize missing version field', async () => {
    const data = {
      info: { title: 'API', description: 'Desc' },
      paths: { '/a': {} },
      servers: [{ url: 'https://api.example.com' }],
    };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('version')));
  });

  it('should penalize missing info.title', async () => {
    const data = { openapi: '3.0.0', info: {}, paths: { '/a': {} } };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('title')));
  });

  it('should penalize missing info.description', async () => {
    const data = { openapi: '3.0.0', info: { title: 'API' }, paths: { '/a': {} } };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('description')));
  });

  it('should penalize no paths', async () => {
    const data = { openapi: '3.0.0', info: { title: 'API', description: 'D' }, paths: {} };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('paths')));
  });

  it('should penalize no servers', async () => {
    const data = { openapi: '3.0.0', info: { title: 'API', description: 'D' }, paths: { '/a': {} } };
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('servers')));
  });

  it('should clamp score between 0 and 100', async () => {
    const data = {};
    const ctx = mockContext({
      '/openapi.json': mockResponse({ body: JSON.stringify(data) }),
    });
    const result = await check(ctx);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

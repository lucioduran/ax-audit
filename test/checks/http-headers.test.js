import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/http-headers.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('http-headers', () => {
  it('should return score 0 when no headers available', async () => {
    const ctx = mockContext({}, { headers: {} });
    const result = await check(ctx);
    assert.equal(result.score, 0);
  });

  it('should score well with all security headers and AI Link headers', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'referrer-policy': 'no-referrer',
      'permissions-policy': 'camera=()',
      'content-security-policy': "default-src 'self'",
      'link': '<https://example.com/llms.txt>; rel="alternate", <https://example.com/.well-known/agent.json>; rel="alternate"',
    };
    const ctx = mockContext(
      {
        '/agent.json': mockResponse({ headers: { 'access-control-allow-origin': '*' } }),
        '/llms.txt': mockResponse({ headers: { 'x-robots-tag': 'noindex' } }),
      },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.score >= 90);
  });

  it('should penalize missing critical security headers', async () => {
    const headers = {
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    };
    const ctx = mockContext(
      { '/agent.json': mockResponse({ ok: false, status: 404 }) },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('Strict-Transport-Security')));
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('X-Content-Type-Options')));
  });

  it('should penalize missing Link header', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
    };
    const ctx = mockContext(
      { '/agent.json': mockResponse({ ok: false, status: 404 }) },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('Link header')));
  });

  it('should penalize Link header without AI references', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'link': '<https://example.com/style.css>; rel="stylesheet"',
    };
    const ctx = mockContext(
      { '/agent.json': mockResponse({ ok: false, status: 404 }) },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('does not reference AI')));
  });

  it('should detect partial Link header (only llms.txt)', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
      'link': '<https://example.com/llms.txt>; rel="alternate"',
    };
    const ctx = mockContext(
      { '/agent.json': mockResponse({ ok: false, status: 404 }) },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('llms.txt')));
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('agent.json')));
  });

  it('should penalize missing CORS on .well-known', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
    };
    const ctx = mockContext(
      { '/agent.json': mockResponse({ headers: {} }) },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('CORS')));
  });

  it('should pass CORS when access-control-allow-origin is present', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
    };
    const ctx = mockContext(
      { '/agent.json': mockResponse({ headers: { 'access-control-allow-origin': '*' } }) },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('CORS')));
  });

  it('should detect X-Robots-Tag noindex on llms.txt', async () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000',
      'x-content-type-options': 'nosniff',
    };
    const ctx = mockContext(
      {
        '/agent.json': mockResponse({ ok: false, status: 404 }),
        '/llms.txt': mockResponse({ headers: { 'x-robots-tag': 'noindex' } }),
      },
      { headers },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('X-Robots-Tag')));
  });

  it('should clamp score between 0 and 100', async () => {
    const ctx = mockContext(
      { '/agent.json': mockResponse({ ok: false, status: 404 }) },
      { headers: { 'some-random': 'header' } },
    );
    const result = await check(ctx);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

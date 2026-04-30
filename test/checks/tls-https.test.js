import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/tls-https.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('tls-https', () => {
  it('should fail on invalid URL', async () => {
    const ctx = mockContext({}, { url: 'not a url' });
    const result = await check(ctx);
    assert.equal(result.score, 0);
  });

  it('should score 100 with HTTPS, HTTP→HTTPS redirect, and full HSTS preload', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({
          status: 301,
          ok: true,
          url: 'https://example.com/',
          body: '',
        }),
      },
      {
        url: 'https://example.com',
        headers: {
          'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
        },
      },
    );
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should fail when site is plain HTTP', async () => {
    const ctx = mockContext({}, { url: 'http://example.com' });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('not HTTPS')));
    assert.ok(result.score < 60);
  });

  it('should warn when HSTS header is missing', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({ ok: true, url: 'https://example.com/' }),
      },
      { url: 'https://example.com', headers: {} },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('Strict-Transport-Security')));
  });

  it('should warn when HSTS max-age is short', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({ ok: true, url: 'https://example.com/' }),
      },
      {
        url: 'https://example.com',
        headers: { 'strict-transport-security': 'max-age=600' },
      },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('short')));
  });

  it('should warn when HSTS lacks includeSubDomains', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({ ok: true, url: 'https://example.com/' }),
      },
      {
        url: 'https://example.com',
        headers: { 'strict-transport-security': 'max-age=31536000' },
      },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('subdomains')));
  });

  it('should warn when HSTS lacks preload directive', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({ ok: true, url: 'https://example.com/' }),
      },
      {
        url: 'https://example.com',
        headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains' },
      },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('preload')));
  });

  it('should warn when HSTS preload is set but max-age too short', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({ ok: true, url: 'https://example.com/' }),
      },
      {
        url: 'https://example.com',
        headers: { 'strict-transport-security': 'max-age=86400; includeSubDomains; preload' },
      },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('preload')));
  });

  it('should fail when HTTP does not redirect to HTTPS', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({
          ok: true,
          status: 200,
          url: 'http://example.com/',
          body: 'plain http response',
        }),
      },
      {
        url: 'https://example.com',
        headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains; preload' },
      },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('did not redirect')));
  });

  it('should accept HTTPS-only sites where HTTP is unreachable', async () => {
    const ctx = mockContext(
      {
        'http://example.com': mockResponse({ status: 0, ok: false, body: '' }),
      },
      {
        url: 'https://example.com',
        headers: { 'strict-transport-security': 'max-age=31536000; includeSubDomains; preload' },
      },
    );
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('HTTPS-only')));
  });

  it('should clamp score within [0,100]', async () => {
    const ctx = mockContext({}, { url: 'http://example.com' });
    const result = await check(ctx);
    assert.ok(result.score >= 0 && result.score <= 100);
  });
});

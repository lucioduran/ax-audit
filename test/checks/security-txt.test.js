import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/security-txt.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('security-txt', () => {
  it('should return score 0 when security.txt is not found', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should score 100 for a fully compliant security.txt', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const body = [
      `Contact: mailto:security@example.com`,
      `Expires: ${futureDate}`,
      `Canonical: https://example.com/.well-known/security.txt`,
      `Preferred-Languages: en`,
      `Policy: https://example.com/security-policy`,
    ].join('\n');

    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should penalize missing Contact field', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const body = `Expires: ${futureDate}`;
    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('Contact')));
  });

  it('should penalize missing Expires field', async () => {
    const body = 'Contact: mailto:security@example.com';
    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('Expires')));
  });

  it('should penalize expired date', async () => {
    const pastDate = new Date('2020-01-01').toISOString();
    const body = [
      'Contact: mailto:security@example.com',
      `Expires: ${pastDate}`,
    ].join('\n');

    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('expired')));
  });

  it('should pass with future expiry date', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const body = [
      'Contact: mailto:security@example.com',
      `Expires: ${futureDate}`,
    ].join('\n');

    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('future')));
  });

  it('should penalize no optional fields', async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const body = [
      'Contact: mailto:security@example.com',
      `Expires: ${futureDate}`,
    ].join('\n');

    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('optional')));
  });

  it('should clamp score to 0 minimum', async () => {
    // Both required fields missing + expired
    const body = 'Nothing useful here';
    const ctx = mockContext({
      '/security.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.score >= 0);
  });
});

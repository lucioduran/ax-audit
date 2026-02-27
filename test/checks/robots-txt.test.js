import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/robots-txt.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('robots-txt', () => {
  it('should return score 0 when /robots.txt is not found', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should score well with all core crawlers configured', async () => {
    const body = [
      'User-agent: GPTBot',
      'Allow: /',
      '',
      'User-agent: ClaudeBot',
      'Allow: /',
      '',
      'User-agent: ChatGPT-User',
      'Allow: /',
      '',
      'User-agent: Claude-SearchBot',
      'Allow: /',
      '',
      'User-agent: Google-Extended',
      'Allow: /',
      '',
      'User-agent: PerplexityBot',
      'Allow: /',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    assert.ok(result.score >= 80);
    assert.ok(result.findings.some(f => f.message.includes('All') && f.message.includes('core AI crawlers')));
  });

  it('should penalize missing core crawlers', async () => {
    const body = [
      'User-agent: GPTBot',
      'Allow: /',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('core AI crawlers configured')));
  });

  it('should detect blocked crawlers', async () => {
    const body = [
      'User-agent: GPTBot',
      'Disallow: /',
      '',
      'User-agent: ClaudeBot',
      'Allow: /',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.message.includes('explicitly blocked')));
  });

  it('should detect wildcard blocking unconfigured crawlers', async () => {
    const body = [
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.message.includes('wildcard')));
  });

  it('should handle multi-UA blocks correctly', async () => {
    const body = [
      'User-agent: GPTBot',
      'User-agent: ClaudeBot',
      'Disallow: /',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    // Both GPTBot and ClaudeBot should be blocked
    const blockedFinding = result.findings.find(f => f.message.includes('explicitly blocked'));
    assert.ok(blockedFinding);
    assert.ok(blockedFinding.detail.includes('GPTBot'));
    assert.ok(blockedFinding.detail.includes('ClaudeBot'));
  });

  it('should detect partial path restrictions', async () => {
    const body = [
      'User-agent: GPTBot',
      'Disallow: /private/',
      'Disallow: /api/',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.message.includes('partial path restrictions')));
  });

  it('should penalize missing Sitemap directive', async () => {
    const body = [
      'User-agent: GPTBot',
      'Allow: /',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('Sitemap')));
  });

  it('should skip comment lines', async () => {
    const body = [
      '# This is a comment',
      'User-agent: GPTBot',
      '# Another comment',
      'Allow: /',
      '',
      'Sitemap: https://example.com/sitemap.xml',
    ].join('\n');

    const ctx = mockContext({ '/robots.txt': mockResponse({ body }) });
    const result = await check(ctx);
    // Should still detect GPTBot
    assert.ok(result.findings.some(f => f.message.includes('core AI crawlers')));
  });

  it('should clamp score between 0 and 100', async () => {
    // Many blocked bots should not go below 0
    const lines = ['User-agent: *', 'Disallow: /'];
    const ctx = mockContext({ '/robots.txt': mockResponse({ body: lines.join('\n') }) });
    const result = await check(ctx);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/llms-txt.js';
import { mockContext, mockResponse } from '../helpers.js';

describe('llms-txt', () => {
  it('should return score 0 when /llms.txt is not found', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should return score 100 for a fully compliant llms.txt', async () => {
    const body = [
      '# Example Corp',
      '',
      '> A company that does things.',
      '',
      '## Products',
      '',
      '- [Product A](https://example.com/a)',
      '- [Product B](https://example.com/b)',
      '',
      '## About',
      '',
      'We are a company with many products and services that span across multiple domains.',
    ].join('\n');

    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
      '/llms-full.txt': mockResponse({ body: body + '\n\nMore details...' }),
    });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should penalize missing H1 heading', async () => {
    const body = '> Description\n\n## Section\n\n[Link](https://example.com)\n\nSome filler content to pass the length check easily here.';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.score < 100);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('H1')));
  });

  it('should penalize missing blockquote', async () => {
    const body = '# Title\n\n## Section\n\n[Link](https://example.com)\n\nSome filler content to pass the length check easily here.';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('blockquote')));
  });

  it('should penalize missing section headings', async () => {
    const body = '# Title\n\n> Description\n\n[Link](https://example.com)\n\nSome filler content to pass the length check easily here.';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('section')));
  });

  it('should penalize missing links', async () => {
    const body = '# Title\n\n> Description\n\n## Section\n\nSome filler content to pass the length check easily here without any links.';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('link')));
  });

  it('should penalize minimal content', async () => {
    const body = '# Hi\n\n> Short';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.message.includes('minimal')));
  });

  it('should give bonus for llms-full.txt but cap at 100', async () => {
    const body = '# Title\n\n> Description of things.\n\n## Section\n\n[Link](https://example.com)\n\nSome filler content that is long enough to pass checks.';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
      '/llms-full.txt': mockResponse({ body: 'full content' }),
    });
    const result = await check(ctx);
    assert.ok(result.score <= 100);
    assert.ok(result.findings.some(f => f.message.includes('llms-full.txt') && f.status === 'pass'));
  });

  it('should never return score above 100', async () => {
    const body = '# Title\n\n> Desc block.\n\n## Section\n\n[Link](https://example.com/page)\n\nContent that is definitely long enough to pass the minimum character requirement for this test.';
    const ctx = mockContext({
      '/llms.txt': mockResponse({ body }),
      '/llms-full.txt': mockResponse({ body: 'full' }),
    });
    const result = await check(ctx);
    assert.ok(result.score <= 100);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/seo-basics.js';
import { mockContext } from '../helpers.js';

function fullHtml(opts = {}) {
  const lang = opts.lang ?? 'en';
  const title = opts.title ?? 'Welcome to the Example Corporation Homepage';
  const description = opts.description ?? 'Example Corp builds developer tools that help engineers ship reliable software faster than ever before.';
  const canonical = opts.canonical === undefined ? '<link rel="canonical" href="https://example.com/">' : opts.canonical;
  const charset = opts.charset === false ? '' : '<meta charset="utf-8">';
  const viewport = opts.viewport === false ? '' : '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const hreflang = opts.hreflang ?? '';
  const langAttr = lang === false ? '' : ` lang="${lang}"`;
  return `<!DOCTYPE html>
<html${langAttr}>
  <head>
    ${charset}
    ${viewport}
    <title>${title}</title>
    <meta name="description" content="${description}">
    ${canonical}
    ${hreflang}
  </head>
  <body><main><h1>X</h1></main></body>
</html>`;
}

describe('seo-basics', () => {
  it('should fail with score 0 when no HTML available', async () => {
    const ctx = mockContext({}, { html: '' });
    const result = await check(ctx);
    assert.equal(result.score, 0);
  });

  it('should score 100 for a fully compliant head', async () => {
    const ctx = mockContext({}, { html: fullHtml() });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should fail when <title> is missing', async () => {
    const html = fullHtml().replace(/<title>[^<]*<\/title>/, '');
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('<title>')));
  });

  it('should warn on too-short <title>', async () => {
    const ctx = mockContext({}, { html: fullHtml({ title: 'Hi' }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('too short')));
  });

  it('should warn on too-long <title>', async () => {
    const ctx = mockContext({}, { html: fullHtml({ title: 'A'.repeat(120) }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('too long')));
  });

  it('should fail on missing meta description', async () => {
    const ctx = mockContext({}, { html: fullHtml({ description: undefined }).replace(/<meta name="description"[^>]*>/, '') });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('description')));
  });

  it('should warn on short meta description', async () => {
    const ctx = mockContext({}, { html: fullHtml({ description: 'Short.' }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('short')));
  });

  it('should warn on long meta description', async () => {
    const ctx = mockContext({}, { html: fullHtml({ description: 'A '.repeat(200).trim() }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('long')));
  });

  it('should warn when title and description are duplicates', async () => {
    const same = 'The example corporation builds developer tools to help engineers ship faster';
    const ctx = mockContext({}, { html: fullHtml({ title: same, description: same }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('duplicates the <title>')));
  });

  it('should warn on missing canonical', async () => {
    const ctx = mockContext({}, { html: fullHtml({ canonical: '' }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('canonical')));
  });

  it('should warn on multiple canonical tags', async () => {
    const canonical = '<link rel="canonical" href="https://example.com/"><link rel="canonical" href="https://example.com/other">';
    const ctx = mockContext({}, { html: fullHtml({ canonical }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('canonical')));
  });

  it('should warn on relative canonical href', async () => {
    const ctx = mockContext({}, { html: fullHtml({ canonical: '<link rel="canonical" href="/relative">' }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('not absolute')));
  });

  it('should warn on missing <html lang>', async () => {
    const ctx = mockContext({}, { html: fullHtml({ lang: false }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('lang')));
  });

  it('should warn on invalid <html lang>', async () => {
    const ctx = mockContext({}, { html: fullHtml({ lang: '99zz_BAD' }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('invalid')));
  });

  it('should warn on missing charset', async () => {
    const ctx = mockContext({}, { html: fullHtml({ charset: false }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('charset')));
  });

  it('should accept http-equiv charset', async () => {
    const html = fullHtml({ charset: false }).replace(
      '<head>',
      '<head><meta http-equiv="content-type" content="text/html; charset=utf-8">',
    );
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('UTF-8')));
  });

  it('should warn on missing viewport', async () => {
    const ctx = mockContext({}, { html: fullHtml({ viewport: false }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('viewport')));
  });

  it('should pass with hreflang including x-default', async () => {
    const hreflang =
      '<link rel="alternate" hreflang="en" href="https://example.com/en">' +
      '<link rel="alternate" hreflang="es" href="https://example.com/es">' +
      '<link rel="alternate" hreflang="x-default" href="https://example.com/">';
    const ctx = mockContext({}, { html: fullHtml({ hreflang }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('x-default')));
  });

  it('should warn when hreflang lacks x-default', async () => {
    const hreflang =
      '<link rel="alternate" hreflang="en" href="https://example.com/en">' +
      '<link rel="alternate" hreflang="es" href="https://example.com/es">';
    const ctx = mockContext({}, { html: fullHtml({ hreflang }) });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('x-default')));
  });

  it('should clamp score within [0,100]', async () => {
    const ctx = mockContext({}, { html: '<html></html>' });
    const result = await check(ctx);
    assert.ok(result.score >= 0 && result.score <= 100);
  });
});

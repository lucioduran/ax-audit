import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/structured-data.js';
import { mockContext } from '../helpers.js';

describe('structured-data', () => {
  it('should return score 0 when no HTML available', async () => {
    const ctx = mockContext({}, { html: '' });
    const result = await check(ctx);
    assert.equal(result.score, 0);
  });

  it('should return score 0 when no JSON-LD blocks found', async () => {
    const ctx = mockContext({}, { html: '<html><head></head><body>No structured data</body></html>' });
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.ok(result.findings.some(f => f.status === 'fail' && f.message.includes('No JSON-LD')));
  });

  it('should score well with comprehensive JSON-LD', async () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Example Corp' },
        { '@type': 'WebSite', name: 'Example' },
        { '@type': 'BreadcrumbList', itemListElement: [] },
      ],
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.score >= 90);
  });

  it('should penalize missing @context', async () => {
    const jsonLd = { '@type': 'Organization', name: 'Test' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('@context')));
  });

  it('should accept https://schema.org/ with trailing slash', async () => {
    const jsonLd = { '@context': 'https://schema.org/', '@type': 'Organization', name: 'Test' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('@context')));
  });

  it('should accept http://schema.org', async () => {
    const jsonLd = { '@context': 'http://schema.org', '@type': 'Organization', name: 'Test' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('@context')));
  });

  it('should penalize missing @graph', async () => {
    const jsonLd = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('@graph')));
  });

  it('should detect key entity types in @graph', async () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Person', name: 'John' },
        { '@type': 'WebPage', name: 'Home' },
      ],
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('Person')));
  });

  it('should handle invalid JSON in blocks gracefully', async () => {
    const html = '<html><head><script type="application/ld+json">{invalid json</script></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('Invalid JSON')));
  });

  it('should return 10 when all JSON-LD blocks are invalid', async () => {
    const html = [
      '<html><head>',
      '<script type="application/ld+json">{bad</script>',
      '<script type="application/ld+json">{also bad</script>',
      '</head></html>',
    ].join('');
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.equal(result.score, 10);
  });

  it('should handle HTML entities in JSON-LD', async () => {
    const raw = '{"@context":"https://schema.org","@type":"Organization","name":"A &amp; B"}';
    const html = `<html><head><script type="application/ld+json">${raw}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('JSON-LD block')));
  });

  it('should accept @context as array with schema.org', async () => {
    const jsonLd = { '@context': ['https://schema.org', { '@language': 'en' }], '@type': 'Organization', name: 'Test' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('@context')));
  });

  it('should accept @context as object with @vocab', async () => {
    const jsonLd = { '@context': { '@vocab': 'https://schema.org/' }, '@type': 'Organization', name: 'Test' };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('@context')));
  });

  it('should detect types in nested entities (author, publisher)', async () => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Home',
      author: { '@type': 'Person', name: 'John' },
      publisher: { '@type': 'Organization', name: 'Corp' },
    };
    const html = `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('Person')));
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('Organization')));
  });

  it('should detect multiple JSON-LD blocks', async () => {
    const block1 = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Test' });
    const block2 = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Test' });
    const html = `<html><head><script type="application/ld+json">${block1}</script><script type="application/ld+json">${block2}</script></head></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.message.includes('2 JSON-LD block(s)')));
  });
});

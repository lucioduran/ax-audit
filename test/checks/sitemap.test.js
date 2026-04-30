import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/sitemap.js';
import { mockContext, mockResponse } from '../helpers.js';

const RECENT = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);
const STALE = new Date(Date.now() - 1000 * 60 * 60 * 24 * 500).toISOString().slice(0, 10);

function urlsetXml(urls) {
  const entries = urls
    .map((u) => {
      const lm = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '';
      return `<url><loc>${u.loc}</loc>${lm}</url>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

function indexXml(children) {
  const entries = children.map((c) => `<sitemap><loc>${c}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

describe('sitemap', () => {
  it('should fail when no sitemap can be located', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should locate sitemap via /sitemap.xml fallback', async () => {
    const xml = urlsetXml([
      { loc: 'https://example.com/a', lastmod: RECENT },
      { loc: 'https://example.com/b', lastmod: RECENT },
    ]);
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.score >= 90, `expected >=90 got ${result.score}`);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('Sitemap located')));
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('2 URL')));
  });

  it('should locate sitemap via robots.txt Sitemap: directive', async () => {
    const xml = urlsetXml([{ loc: 'https://example.com/page' }]);
    const ctx = mockContext({
      '/robots.txt': mockResponse({ body: 'User-agent: *\nAllow: /\nSitemap: https://example.com/special-sitemap.xml' }),
      '/special-sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('special-sitemap.xml')));
  });

  it('should fail when sitemap response is not XML', async () => {
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: '<!doctype html><html>not xml</html>', headers: { 'content-type': 'text/html' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('not look like XML')));
  });

  it('should warn on missing or wrong Content-Type', async () => {
    const xml = urlsetXml([{ loc: 'https://example.com/a' }]);
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'text/plain' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('Content-Type')));
  });

  it('should fail on empty <urlset>', async () => {
    const xml = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('no <url>')));
  });

  it('should warn when most URLs lack <lastmod>', async () => {
    const xml = urlsetXml([
      { loc: 'https://example.com/a' },
      { loc: 'https://example.com/b' },
      { loc: 'https://example.com/c', lastmod: RECENT },
      { loc: 'https://example.com/d' },
    ]);
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('have <lastmod>')));
  });

  it('should warn on stale lastmod', async () => {
    const xml = urlsetXml([{ loc: 'https://example.com/a', lastmod: STALE }]);
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('days old')));
  });

  it('should follow a sitemap-index and sample children', async () => {
    const child1 = urlsetXml([
      { loc: 'https://example.com/x', lastmod: RECENT },
      { loc: 'https://example.com/y', lastmod: RECENT },
    ]);
    const child2 = urlsetXml([{ loc: 'https://example.com/z', lastmod: RECENT }]);
    const index = indexXml(['https://example.com/sitemap-1.xml', 'https://example.com/sitemap-2.xml']);
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: index, headers: { 'content-type': 'application/xml' } }),
      '/sitemap-1.xml': mockResponse({ body: child1, headers: { 'content-type': 'application/xml' } }),
      '/sitemap-2.xml': mockResponse({ body: child2, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('references 2 child sitemap')));
    assert.ok(result.findings.some((f) => f.message.includes('3 URL(s)')));
  });

  it('should fail when sitemap-index has no children', async () => {
    const xml = '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>';
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: xml, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('no <sitemap>')));
  });

  it('should warn when not all sample children are reachable', async () => {
    const child1 = urlsetXml([{ loc: 'https://example.com/x', lastmod: RECENT }]);
    const index = indexXml([
      'https://example.com/sitemap-1.xml',
      'https://example.com/missing.xml',
      'https://example.com/missing-2.xml',
    ]);
    const ctx = mockContext({
      '/sitemap.xml': mockResponse({ body: index, headers: { 'content-type': 'application/xml' } }),
      '/sitemap-1.xml': mockResponse({ body: child1, headers: { 'content-type': 'application/xml' } }),
    });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('reachable')));
  });

  it('should clamp score within bounds', async () => {
    const ctx = mockContext();
    const result = await check(ctx);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

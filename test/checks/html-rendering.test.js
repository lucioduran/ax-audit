import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/html-rendering.js';
import { mockContext } from '../helpers.js';

const FILLER = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';

function richHtml(extra = '') {
  const text = FILLER.repeat(20);
  return `
<!DOCTYPE html>
<html lang="en">
  <head><title>Example</title><meta name="description" content="A test page"></head>
  <body>
    <header><nav>Top nav</nav></header>
    <main>
      <article>
        <h1>Welcome to Example</h1>
        <p>${text}</p>
        <p>${text}</p>
        <img src="a.png" alt="A">
        <img src="b.png" alt="B">
      </article>
      <section><p>${text}</p></section>
    </main>
    <footer>Foot</footer>
    ${extra}
  </body>
</html>`;
}

describe('html-rendering', () => {
  it('should fail with score 0 when no HTML is provided', async () => {
    const ctx = mockContext({}, { html: '' });
    const result = await check(ctx);
    assert.equal(result.score, 0);
    assert.equal(result.findings[0].status, 'fail');
  });

  it('should score high for a fully server-rendered semantic page', async () => {
    const ctx = mockContext({}, { html: richHtml() });
    const result = await check(ctx);
    assert.ok(result.score >= 90, `expected >=90 got ${result.score}`);
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('Server-rendered')));
    assert.ok(result.findings.some((f) => f.status === 'pass' && f.message.includes('landmarks')));
  });

  it('should detect an empty SPA shell (#root)', async () => {
    const html = `<!doctype html><html><body><div id="root"></div><script src="bundle.js"></script></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.score < 50, `expected <50 got ${result.score}`);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('Empty SPA mount')));
  });

  it('should detect an empty Next.js shell (#__next)', async () => {
    const html = `<!doctype html><html><body><div id="__next"></div></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'fail' && f.message.includes('__next')));
  });

  it('should warn on sparse but non-empty content', async () => {
    const html = `<!doctype html><html><body><main><h1>Hi</h1><p>Tiny</p></main></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.toLowerCase().includes('sparse')));
  });

  it('should warn when only one semantic landmark is present', async () => {
    const text = FILLER.repeat(20);
    const html = `<!doctype html><html><body><main><h1>Hi</h1><p>${text}</p></main></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('semantic landmark')));
  });

  it('should warn on multiple <h1> headings', async () => {
    const text = FILLER.repeat(20);
    const html = `<!doctype html><html><body><main><h1>One</h1><h1>Two</h1><p>${text}</p><article>x</article><header>x</header></main></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('<h1> headings found')));
  });

  it('should warn when there is no <h1>', async () => {
    const text = FILLER.repeat(20);
    const html = `<!doctype html><html><body><main><h2>Sub</h2><p>${text}</p><article>x</article><header>x</header></main></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('No <h1>')));
  });

  it('should warn when many <img> lack alt attributes', async () => {
    const text = FILLER.repeat(20);
    const html = `<!doctype html><html><body>
      <main>
        <h1>Title</h1>
        <p>${text}</p>
        <article>
          <img src="1.png">
          <img src="2.png">
          <img src="3.png">
          <img src="4.png" alt="ok">
        </article>
        <header>x</header>
      </main>
    </body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.status === 'warn' && f.message.includes('alt attributes')));
  });

  it('should suggest <noscript> when JS is heavy and noscript missing', async () => {
    const text = FILLER.repeat(40);
    const scripts = Array.from({ length: 20 }, (_, i) => `<script src="${i}.js"></script>`).join('');
    const html = `<!doctype html><html><body>${scripts}<main><h1>X</h1><p>${text}</p><article>x</article><header>x</header></main></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some((f) => f.message.includes('<noscript>')));
  });

  it('should not penalize JSON-LD scripts as executable JS', async () => {
    const text = FILLER.repeat(40);
    const ldScripts = Array.from({ length: 20 }, () => `<script type="application/ld+json">{"@context":"https://schema.org"}</script>`).join('');
    const html = `<!doctype html><html><body>${ldScripts}<main><h1>X</h1><p>${text}</p><article>x</article><header>x</header></main></body></html>`;
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(!result.findings.some((f) => f.message.includes('<noscript>')));
  });

  it('should clamp score to 0 minimum', async () => {
    const ctx = mockContext({}, { html: '<html><body></body></html>' });
    const result = await check(ctx);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });

  it('should never return score above 100', async () => {
    const ctx = mockContext({}, { html: richHtml() });
    const result = await check(ctx);
    assert.ok(result.score <= 100);
  });
});

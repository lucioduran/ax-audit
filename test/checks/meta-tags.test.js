import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import check from '../../dist/checks/meta-tags.js';
import { mockContext } from '../helpers.js';

describe('meta-tags', () => {
  it('should return score 0 when no HTML available', async () => {
    const ctx = mockContext({}, { html: '' });
    const result = await check(ctx);
    assert.equal(result.score, 0);
  });

  it('should score 100 with all AI meta tags and links', async () => {
    const html = [
      '<html><head>',
      '<meta name="ai:summary" content="A website">',
      '<meta name="ai:content_type" content="website">',
      '<meta name="ai:author" content="John">',
      '<meta name="ai:api" content="https://api.example.com">',
      '<meta name="ai:agent_card" content="https://example.com/agent.json">',
      '<link rel="alternate" href="/llms.txt" type="text/plain">',
      '<link rel="alternate" href="/agent.json" type="application/json">',
      '<link rel="me" href="https://twitter.com/example">',
      '<link rel="me" href="https://github.com/example">',
      '<link rel="me" href="https://linkedin.com/in/example">',
      '<meta property="og:title" content="Example">',
      '</head></html>',
    ].join('\n');
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.equal(result.score, 100);
  });

  it('should penalize missing AI meta tags', async () => {
    const html = '<html><head><meta property="og:title" content="Test"></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('AI meta tags')));
  });

  it('should pass with 3+ AI meta tags', async () => {
    const html = [
      '<html><head>',
      '<meta name="ai:summary" content="A site">',
      '<meta name="ai:content_type" content="website">',
      '<meta name="ai:author" content="John">',
      '<link rel="alternate" href="/llms.txt">',
      '<link rel="alternate" href="/agent.json">',
      '<link rel="me" href="https://example.com">',
      '<meta property="og:title" content="Test">',
      '</head></html>',
    ].join('\n');
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('AI meta tags')));
  });

  it('should penalize missing rel="alternate" to llms.txt', async () => {
    const html = '<html><head><meta property="og:title" content="Test"></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('llms.txt')));
  });

  it('should penalize missing rel="alternate" to agent.json', async () => {
    const html = '<html><head><meta property="og:title" content="Test"></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('agent.json')));
  });

  it('should penalize missing rel="me" links', async () => {
    const html = '<html><head><meta property="og:title" content="Test"></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('rel="me"')));
  });

  it('should penalize missing OpenGraph tags', async () => {
    const html = '<html><head></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'warn' && f.message.includes('OpenGraph')));
  });

  it('should detect alternate with attributes in any order', async () => {
    const html = '<html><head><link href="/llms.txt" rel="alternate" type="text/plain"></head></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.findings.some(f => f.status === 'pass' && f.message.includes('llms.txt')));
  });

  it('should clamp score to 0 minimum', async () => {
    const html = '<html><head></head><body></body></html>';
    const ctx = mockContext({}, { html });
    const result = await check(ctx);
    assert.ok(result.score >= 0);
    assert.ok(result.score <= 100);
  });
});

/**
 * Shared test helpers for creating mock contexts and fetch responses.
 */

/**
 * Create a mock FetchResponse.
 */
export function mockResponse(overrides = {}) {
  return {
    status: 200,
    headers: {},
    body: '',
    ok: true,
    url: '',
    ...overrides,
  };
}

/**
 * Create a mock CheckContext with a route-based fake fetch.
 * @param {Record<string, import('../dist/types.js').FetchResponse>} routes - URL pattern to response mapping
 * @param {object} options - Additional context options
 */
export function mockContext(routes = {}, options = {}) {
  return {
    url: options.url || 'https://example.com',
    html: options.html || '',
    headers: options.headers || {},
    fetch: async (url) => {
      for (const [pattern, response] of Object.entries(routes)) {
        if (url.includes(pattern)) return response;
      }
      return mockResponse({ status: 404, ok: false, body: '', url });
    },
  };
}

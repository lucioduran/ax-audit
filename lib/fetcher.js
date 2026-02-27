import { USER_AGENT } from './constants.js';

/**
 * Creates a fetch wrapper with in-memory caching, timeout, and custom user-agent.
 * @param {{ timeout?: number }} options
 */
export function createFetcher({ timeout = 10000 } = {}) {
  const cache = new Map();

  /**
   * Fetch a URL with caching and timeout.
   * Returns a normalized response object (never throws).
   */
  async function fetchUrl(url) {
    if (cache.has(url)) return cache.get(url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html, application/json, text/plain, */*',
        },
        redirect: 'follow',
      });

      const body = await response.text();

      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const result = {
        status: response.status,
        headers,
        body,
        ok: response.ok,
        url: response.url,
      };

      cache.set(url, result);
      return result;
    } catch (err) {
      const result = {
        status: 0,
        headers: {},
        body: '',
        ok: false,
        url,
        error: err.name === 'AbortError' ? 'Request timed out' : err.message,
      };
      cache.set(url, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  return { fetch: fetchUrl, fetchPage: fetchUrl };
}

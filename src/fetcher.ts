import { USER_AGENT } from './constants.js';
import type { FetchResponse } from './types.js';

interface FetcherOptions {
  timeout?: number;
  verbose?: boolean;
}

interface Fetcher {
  fetch: (url: string) => Promise<FetchResponse>;
  fetchPage: (url: string) => Promise<FetchResponse>;
}

export function createFetcher({ timeout = 10000, verbose = false }: FetcherOptions = {}): Fetcher {
  const cache = new Map<string, FetchResponse>();
  const log = verbose ? (msg: string) => console.error(`  [verbose] ${msg}`) : () => {};

  async function fetchUrl(url: string): Promise<FetchResponse> {
    if (cache.has(url)) {
      log(`cache hit: ${url}`);
      return cache.get(url)!;
    }
    log(`fetch: ${url}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html, application/json, text/plain, */*',
        },
        redirect: 'follow',
      });

      const body = await response.text();

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      const result: FetchResponse = {
        status: response.status,
        headers,
        body,
        ok: response.ok,
        url: response.url,
      };

      log(`  ${response.status} ${response.statusText} (${body.length} bytes)`);
      cache.set(url, result);
      return result;
    } catch (err: unknown) {
      const error = err as Error & { name: string };
      const errorMsg = error.name === 'AbortError' ? 'Request timed out' : error.message;
      log(`  ERROR: ${errorMsg}`);
      const result: FetchResponse = {
        status: 0,
        headers: {},
        body: '',
        ok: false,
        url,
        error: errorMsg,
      };
      cache.set(url, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  return { fetch: fetchUrl, fetchPage: fetchUrl };
}

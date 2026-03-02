const BASE_URL = 'https://lucioduran.com/projects/ax-audit/guides';

export function guideUrl(checkId: string, anchor?: string): string {
  return anchor ? `${BASE_URL}/${checkId}#${anchor}` : `${BASE_URL}/${checkId}`;
}

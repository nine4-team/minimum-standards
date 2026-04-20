const SHARE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const DEFAULT_SHARE_BASE_URL = 'minimumstandards://snapshot/';

export function generateShareCode(length = 8): string {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * SHARE_CODE_ALPHABET.length);
    result += SHARE_CODE_ALPHABET[index];
  }
  return result;
}

export function buildSnapshotShareUrl(shareCode: string): string {
  return `${DEFAULT_SHARE_BASE_URL}${encodeURIComponent(shareCode)}`;
}

function parseQueryParams(url: string): Record<string, string> {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return {};
  }
  const queryString = url.slice(queryIndex + 1);
  return queryString
    .split('&')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [key, value] = part.split('=');
      if (!key) {
        return acc;
      }
      acc[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
      return acc;
    }, {});
}

export function extractShareCodeFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  // Don't match group join URLs
  if (trimmed.includes('/group/join/')) {
    return null;
  }

  const params = parseQueryParams(trimmed);
  const queryCode = params.shareCode || params.code || params.snapshotCode;
  if (queryCode) {
    return queryCode.toUpperCase();
  }

  const pathStart = trimmed.indexOf('://') !== -1 ? trimmed.split('://')[1] : trimmed;
  const pathParts = pathStart.split('/');
  const lastSegment = pathParts[pathParts.length - 1] ?? '';
  if (!lastSegment) {
    return null;
  }
  if (lastSegment.includes('?')) {
    return lastSegment.split('?')[0].toUpperCase();
  }
  return lastSegment.toUpperCase();
}

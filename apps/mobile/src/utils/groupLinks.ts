const GROUP_JOIN_BASE_URL = 'https://minimum-standards.web.app/group/join/';

export function buildGroupJoinUrl(inviteCode: string): string {
  return `${GROUP_JOIN_BASE_URL}${encodeURIComponent(inviteCode)}`;
}

export function extractGroupInviteCodeFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  // Match deep link: minimumstandards://group/join/{code}
  const deepLinkMatch = trimmed.match(/minimumstandards:\/\/group\/join\/([^?/]+)/i);
  if (deepLinkMatch) {
    return decodeURIComponent(deepLinkMatch[1]).toUpperCase();
  }

  // Match web URL: https://minimum-standards.web.app/group/join/{code}
  const webMatch = trimmed.match(/\/group\/join\/([^?/]+)/i);
  if (webMatch) {
    return decodeURIComponent(webMatch[1]).toUpperCase();
  }

  return null;
}

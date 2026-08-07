export interface DomainRule {
  hostname: string;
  includeSubdomains: boolean;
}

export interface PrivacyExclusionRule {
  hostname: string;
  includeSubdomains: boolean;
  pathPrefix: string;
}

const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const identifierPattern = /^(?:\d{4,}|[0-9a-f]{8}-[0-9a-f-]{27,})$/i;
const secretLikePattern = /^[A-Za-z0-9_-]{24,}$/;

export function hostnameMatches(rule: DomainRule, hostname: string) {
  const normalizedHostname = hostname.toLowerCase();
  const normalizedRule = rule.hostname.toLowerCase();
  return (
    normalizedHostname === normalizedRule ||
    (rule.includeSubdomains &&
      normalizedHostname.endsWith(`.${normalizedRule}`))
  );
}

function sanitizePathSegment(segment: string) {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return ':encoded';
  }

  if (emailPattern.test(decoded)) return ':email';
  if (identifierPattern.test(decoded)) return ':id';
  if (secretLikePattern.test(decoded)) return ':token';
  if (/(?:\d[ -]?){7,}/.test(decoded)) return ':redacted';
  return segment.slice(0, 80);
}

export function normalizeBrowserUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  const pathSegments = url.pathname.split('/').map(sanitizePathSegment);
  let normalizedPath = pathSegments.join('/') || '/';
  if (!normalizedPath.startsWith('/')) normalizedPath = `/${normalizedPath}`;
  if (normalizedPath.length > 512)
    normalizedPath = normalizedPath.slice(0, 512);

  return {
    hostname: url.hostname.toLowerCase(),
    normalizedPath,
  };
}

export function pathIsExcluded(path: string, prefix: string) {
  if (prefix === '/') return true;
  const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  return path === normalizedPrefix || path.startsWith(`${normalizedPrefix}/`);
}

export function isObservableUrl(
  rawUrl: string,
  domains: DomainRule[],
  exclusions: PrivacyExclusionRule[],
) {
  let location: ReturnType<typeof normalizeBrowserUrl>;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return false;
    location = normalizeBrowserUrl(rawUrl);
  } catch {
    return false;
  }

  const approved = domains.some((rule) =>
    hostnameMatches(rule, location.hostname),
  );
  if (!approved) return false;

  return !exclusions.some(
    (rule) =>
      hostnameMatches(rule, location.hostname) &&
      pathIsExcluded(location.normalizedPath, rule.pathPrefix),
  );
}

export function domainPermissionPatterns(rule: DomainRule) {
  const hosts = rule.includeSubdomains
    ? [rule.hostname, `*.${rule.hostname}`]
    : [rule.hostname];
  return hosts.flatMap((hostname) => [
    `http://${hostname}/*`,
    `https://${hostname}/*`,
  ]);
}

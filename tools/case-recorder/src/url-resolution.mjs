const DEFAULT_BASE_URL = "https://playwright.dev";
const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

export function resolveCaseTarget({ baseUrl = DEFAULT_BASE_URL, path: requestedPath = "/" } = {}) {
  const normalizedBaseUrl = requiredText(baseUrl, "baseUrl");
  const navigationTarget = pathText(requestedPath, "/");

  if (isAbsoluteHttpUrl(navigationTarget)) {
    return {
      baseUrl: normalizedBaseUrl,
      path: navigationTarget,
      navigationTarget,
      resolvedUrl: navigationTarget
    };
  }

  return {
    baseUrl: normalizedBaseUrl,
    path: navigationTarget,
    navigationTarget,
    resolvedUrl: resolveNavigationUrl(normalizedBaseUrl, navigationTarget)
  };
}

export function resolveNavigationUrl(baseUrl, navigationTarget) {
  const normalizedBaseUrl = requiredText(baseUrl, "baseUrl");
  const target = pathText(navigationTarget, "/");

  if (isAbsoluteHttpUrl(target)) {
    return target;
  }

  try {
    return new URL(target, normalizedBaseUrl).href;
  } catch (error) {
    throw new Error(`Unable to resolve path '${target}' against base URL '${normalizedBaseUrl}': ${error.message}`);
  }
}

export function navigationTargetForRecordedUrl(recordedUrl, { baseUrl, fallbackTarget } = {}) {
  const recordedTarget = pathText(recordedUrl, undefined);
  if (recordedTarget === undefined) {
    return fallbackTarget;
  }

  if (baseUrl && fallbackTarget !== undefined && resolvesToSameUrl(baseUrl, fallbackTarget, recordedTarget)) {
    return fallbackTarget;
  }

  if (isAbsoluteHttpUrl(recordedTarget)) {
    try {
      const parsedRecordedUrl = new URL(recordedTarget);
      const parsedBaseUrl = baseUrl ? new URL(baseUrl) : null;
      if (parsedBaseUrl && parsedRecordedUrl.origin === parsedBaseUrl.origin) {
        return `${parsedRecordedUrl.pathname}${parsedRecordedUrl.search}${parsedRecordedUrl.hash}` || "/";
      }
      return recordedTarget;
    } catch {
      return fallbackTarget ?? recordedTarget;
    }
  }

  return recordedTarget.startsWith("/") || !baseUrl
    ? recordedTarget
    : fallbackTarget ?? recordedTarget;
}

export function isAbsoluteHttpUrl(value) {
  return typeof value === "string" && ABSOLUTE_HTTP_URL.test(value.trim());
}

function resolvesToSameUrl(baseUrl, candidateTarget, expectedUrl) {
  try {
    const resolvedCandidate = isAbsoluteHttpUrl(candidateTarget)
      ? new URL(candidateTarget).href
      : new URL(pathText(candidateTarget, "/"), baseUrl).href;
    return resolvedCandidate === new URL(expectedUrl).href;
  } catch {
    return false;
  }
}

function requiredText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required ${label}`);
  }
  return value.trim();
}

function pathText(value, fallback) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string") {
    return fallback;
  }
  return value.trim();
}

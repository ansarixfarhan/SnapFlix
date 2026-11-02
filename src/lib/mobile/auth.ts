import { MOBILE_API_KEY_HEADER } from "./constants";
import { cleanSecret, safeStringEqual } from "./text";

/**
 * Optional application-key gate. When unset, endpoints remain public but are
 * rate limited and protected by the Cloudflare WAF rule described in the docs.
 */
export function expectedMobileApiKey(): string | null {
  return cleanSecret(process.env.MOBILE_API_KEY);
}

export function isMobileApiKeyEnabled(): boolean {
  return expectedMobileApiKey() !== null;
}

export function isMobileRequestAuthorized(request: Request): boolean {
  const expected = expectedMobileApiKey();
  if (!expected) return true;
  const provided = request.headers.get(MOBILE_API_KEY_HEADER);
  return provided !== null && safeStringEqual(provided.trim(), expected);
}

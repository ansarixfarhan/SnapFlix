import assert from "node:assert/strict";
import test from "node:test";

import {
  isMobileApiKeyEnabled,
  isMobileRequestAuthorized,
} from "../../src/lib/mobile/auth";
import { createMobileCache } from "../../src/lib/mobile/cache";
import {
  clientKeyFromHeaders,
  createRateLimiter,
} from "../../src/lib/mobile/rate-limit";
import { safeStringEqual } from "../../src/lib/mobile/text";

test("memory cache expires entries, evicts oldest keys and coalesces in-flight loads", async () => {
  const cache = createMobileCache(2);
  cache.set("a", 1, 1_000, 0);
  cache.set("b", 2, 5_000, 0);
  assert.equal(cache.get("a", 999), 1);
  assert.equal(cache.get("a", 1_000), undefined);

  cache.set("c", 3, 5_000, 1_000);
  cache.set("d", 4, 5_000, 1_000);
  assert.equal(cache.size, 2);
  assert.equal(cache.get("b", 1_000), undefined);
  assert.equal(cache.get("c", 1_000), 3);
  assert.equal(cache.get("d", 1_000), 4);

  let calls = 0;
  const load = async (): Promise<string> => {
    calls += 1;
    await Promise.resolve();
    return "shared";
  };
  const first = cache.run("in-flight", 1_000, load);
  const second = cache.run("in-flight", 1_000, load);
  assert.equal(await first, "shared");
  assert.equal(await second, "shared");
  assert.equal(calls, 1);

  await assert.rejects(
    cache.run("failed", 1_000, async () => {
      throw new Error("TMDB failed");
    }),
    /TMDB failed/,
  );
  assert.equal(cache.get("failed"), undefined);
});

test("rate limiter refills tokens, supports request cost and exposes retry timing", () => {
  const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, maxKeys: 10 });
  assert.equal(limiter.consume("ip", 2, 0).allowed, true);
  assert.equal(limiter.consume("ip", 1, 1_000).allowed, true);

  const denied = limiter.consume("ip", 1, 2_000);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.ok(denied.retryAfterSeconds >= 1);
  assert.equal(limiter.consume("ip", 1, 62_000).allowed, true);
});

test("client identity uses Cloudflare's IP header, not a spoofable forwarded header", () => {
  assert.equal(
    clientKeyFromHeaders(new Headers({ "cf-connecting-ip": "203.0.113.7" })),
    "203.0.113.7",
  );
  assert.equal(
    clientKeyFromHeaders(new Headers({ "x-forwarded-for": "198.51.100.7" })),
    "unknown",
  );
  assert.equal(
    clientKeyFromHeaders(new Headers({ "cf-connecting-ip": "bad<script>" })),
    "badscript",
  );
});

test("optional app key uses a length-checked comparison and is opt-in", () => {
  const previous = process.env.MOBILE_API_KEY;
  const key = "local-mobile-key-1234567890";

  try {
    delete process.env.MOBILE_API_KEY;
    assert.equal(isMobileApiKeyEnabled(), false);
    assert.equal(isMobileRequestAuthorized(new Request("https://example.test")), true);

    process.env.MOBILE_API_KEY = key;
    assert.equal(isMobileApiKeyEnabled(), true);
    assert.equal(
      isMobileRequestAuthorized(
        new Request("https://example.test", {
          headers: { "x-snapflix-mobile-key": "wrong-key" },
        }),
      ),
      false,
    );
    assert.equal(
      isMobileRequestAuthorized(
        new Request("https://example.test", {
          headers: { "x-snapflix-mobile-key": key },
        }),
      ),
      true,
    );
    assert.equal(safeStringEqual(key, key), true);
    assert.equal(safeStringEqual(key, `${key}x`), false);
  } finally {
    if (previous === undefined) delete process.env.MOBILE_API_KEY;
    else process.env.MOBILE_API_KEY = previous;
  }
});

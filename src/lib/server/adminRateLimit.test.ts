import { describe, expect, it } from "vitest";
import {
  ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES,
  adminLoginRateLimitKey,
  checkAdminLoginRateLimit,
  clearAdminLoginRateLimit,
  recordAdminLoginFailure,
  type RateLimitKv
} from "@/lib/server/adminRateLimit";

class MemoryKv implements RateLimitKv {
  store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }

  async delete(key: string) {
    this.store.delete(key);
  }
}

function request(headers: Record<string, string> = {}) {
  return new Request("https://example.com/api/admin/login", { headers });
}

describe("admin login rate limit", () => {
  it("hashes IP and email out of the KV key", async () => {
    const key = await adminLoginRateLimitKey(
      request({ "CF-Connecting-IP": "203.0.113.10" }),
      "Admin@Example.com"
    );

    expect(key).toMatch(/^admin-rate:[a-f0-9]{64}$/);
    expect(key).not.toContain("203.0.113.10");
    expect(key).not.toContain("Admin@Example.com");
  });

  it("increments failures and blocks on the configured limit", async () => {
    const kv = new MemoryKv();
    const key = await adminLoginRateLimitKey(
      request({ "x-forwarded-for": "203.0.113.20" }),
      "a@b.com"
    );

    for (let i = 1; i < ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES; i += 1) {
      const result = await recordAdminLoginFailure(kv, key);
      expect(result.limited).toBe(false);
    }

    const stateBeforeBlock = JSON.parse(kv.store.get(key) || "{}") as { failures: number };
    expect(stateBeforeBlock.failures).toBe(ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES - 1);

    const blocked = await recordAdminLoginFailure(kv, key);
    expect(blocked.limited).toBe(true);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect((await checkAdminLoginRateLimit(kv, key)).limited).toBe(true);
  });

  it("clears the counter after a successful login", async () => {
    const kv = new MemoryKv();
    const key = await adminLoginRateLimitKey(
      request({ "CF-Connecting-IP": "203.0.113.30" }),
      "a@b.com"
    );

    await recordAdminLoginFailure(kv, key);
    await clearAdminLoginRateLimit(kv, key);

    expect(await kv.get(key)).toBeNull();
    expect((await checkAdminLoginRateLimit(kv, key)).limited).toBe(false);
  });
});

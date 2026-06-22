export type RateLimitKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

export const ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES = 5;
export const ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
export const ADMIN_LOGIN_RATE_LIMIT_LOCK_SECONDS = 10 * 60;

type RateLimitState = {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
};

type RateLimitResult = {
  limited: boolean;
  retryAfterSeconds?: number;
};

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function parseState(value: string | null): RateLimitState | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value) as Partial<RateLimitState>;
    return {
      failures: Number(data.failures || 0),
      firstFailureAt: Number(data.firstFailureAt || 0),
      lockedUntil: Number(data.lockedUntil || 0)
    };
  } catch {
    return null;
  }
}

function retryAfter(lockedUntil: number, now = nowSeconds()) {
  return Math.max(1, lockedUntil - now);
}

function clientIp(request: Request) {
  const cfIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (cfIp) return cfIp;
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function adminLoginRateLimitKey(request: Request, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const hash = await sha256Hex(`${clientIp(request)}\n${normalizedEmail}`);
  return `admin-rate:${hash}`;
}

export async function checkAdminLoginRateLimit(
  kv: RateLimitKv | null | undefined,
  key: string
): Promise<RateLimitResult> {
  if (!kv) return { limited: false };

  try {
    const state = parseState(await kv.get(key));
    if (!state || !state.lockedUntil) return { limited: false };

    const now = nowSeconds();
    if (state.lockedUntil > now) {
      return { limited: true, retryAfterSeconds: retryAfter(state.lockedUntil, now) };
    }

    await kv.delete(key);
    return { limited: false };
  } catch {
    return { limited: false };
  }
}

export async function recordAdminLoginFailure(
  kv: RateLimitKv | null | undefined,
  key: string
): Promise<RateLimitResult> {
  if (!kv) return { limited: false };

  try {
    const now = nowSeconds();
    const current = parseState(await kv.get(key));
    const withinWindow =
      current && now - current.firstFailureAt < ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS;
    const next: RateLimitState = withinWindow
      ? { ...current, failures: current.failures + 1 }
      : { failures: 1, firstFailureAt: now, lockedUntil: 0 };

    if (next.failures >= ADMIN_LOGIN_RATE_LIMIT_MAX_FAILURES) {
      next.lockedUntil = now + ADMIN_LOGIN_RATE_LIMIT_LOCK_SECONDS;
    }

    await kv.put(key, JSON.stringify(next), {
      expirationTtl: next.lockedUntil
        ? ADMIN_LOGIN_RATE_LIMIT_LOCK_SECONDS
        : ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS
    });

    if (next.lockedUntil > now) {
      return { limited: true, retryAfterSeconds: retryAfter(next.lockedUntil, now) };
    }

    return { limited: false };
  } catch {
    return { limited: false };
  }
}

export async function clearAdminLoginRateLimit(kv: RateLimitKv | null | undefined, key: string) {
  if (!kv) return;
  try {
    await kv.delete(key);
  } catch {
    // Login must not fail because the rate-limit cleanup failed.
  }
}

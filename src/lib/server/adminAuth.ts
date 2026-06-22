import type { APIContext } from "astro";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env as cloudflareEnv } from "cloudflare:workers";

const ACCESS_COOKIE = "julio_admin_access_token";
const REFRESH_COOKIE = "julio_admin_refresh_token";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type AdminSession = {
  accessToken: string;
  refreshToken: string;
  serviceClient: SupabaseClient;
  user: User;
  userClient: SupabaseClient;
};

type AdminAuthContext = Pick<APIContext, "cookies" | "request">;

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export class AdminAuthError extends Error {
  status: number;

  constructor(status: number, message = "Unauthorized") {
    super(message);
    this.status = status;
  }
}

function cloudflareRuntimeValue(key: string) {
  const runtimeValue = cloudflareEnv[key];
  if (typeof runtimeValue === "string" && runtimeValue) return runtimeValue;
  return "";
}

function supabaseUrl() {
  return cloudflareRuntimeValue("PUBLIC_SUPABASE_URL") || import.meta.env.PUBLIC_SUPABASE_URL || "";
}

function supabaseAnonKey() {
  return (
    cloudflareRuntimeValue("PUBLIC_SUPABASE_ANON_KEY") ||
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

function supabaseServiceRoleKey() {
  return (
    cloudflareRuntimeValue("SUPABASE_SERVICE_ROLE_KEY") ||
    process?.env?.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

function requireSupabaseConfig() {
  if (!supabaseUrl() || !supabaseAnonKey() || !supabaseServiceRoleKey()) {
    throw new AdminAuthError(500, "Admin auth is not configured");
  }
}

export function createAnonClient(accessToken?: string) {
  if (!supabaseUrl() || !supabaseAnonKey()) {
    throw new AdminAuthError(500, "Supabase is not configured");
  }

  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined
  });
}

export function createServiceClient() {
  requireSupabaseConfig();
  return createClient(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isSecureCookieContext(context: AdminAuthContext) {
  const url = new URL(context.request.url);
  return import.meta.env.PROD || url.protocol === "https:";
}

function cookieOptions(context: AdminAuthContext, maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "strict" as const,
    secure: isSecureCookieContext(context)
  };
}

export function setAdminCookies(context: AdminAuthContext, session: Session) {
  context.cookies.set(
    ACCESS_COOKIE,
    session.access_token,
    cookieOptions(context, session.expires_in || 3600)
  );
  context.cookies.set(
    REFRESH_COOKIE,
    session.refresh_token,
    cookieOptions(context, COOKIE_MAX_AGE_SECONDS)
  );
}

export function clearAdminCookies(context: AdminAuthContext) {
  context.cookies.set(ACCESS_COOKIE, "", cookieOptions(context, 0));
  context.cookies.set(REFRESH_COOKIE, "", cookieOptions(context, 0));
}

async function refreshAdminSession(context: AdminAuthContext, refreshToken: string) {
  const anon = createAnonClient();
  const { data, error } = await anon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session?.access_token || !data.user) {
    clearAdminCookies(context);
    throw new AdminAuthError(401);
  }
  setAdminCookies(context, data.session);
  return data.session;
}

export async function getAdminSession(
  context: AdminAuthContext,
  options: { required?: boolean } = {}
): Promise<AdminSession | null> {
  const required = options.required !== false;
  const accessCookie = context.cookies.get(ACCESS_COOKIE)?.value || "";
  const refreshCookie = context.cookies.get(REFRESH_COOKIE)?.value || "";
  if (!accessCookie && !refreshCookie) {
    if (required) throw new AdminAuthError(401);
    return null;
  }

  const serviceClient = (() => {
    try {
      return createServiceClient();
    } catch (error) {
      if (required) throw error;
      return null;
    }
  })();

  if (!serviceClient) return null;

  let accessToken = accessCookie;
  let refreshToken = refreshCookie;
  let user: User | null = null;

  if (accessToken) {
    const { data, error } = await createAnonClient().auth.getUser(accessToken);
    if (!error && data.user) user = data.user;
  }

  if (!user && refreshToken) {
    try {
      const refreshed = await refreshAdminSession(context, refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token;
      user = refreshed.user;
    } catch (error) {
      if (required) throw error;
      clearAdminCookies(context);
      return null;
    }
  }

  if (!user || !accessToken) {
    clearAdminCookies(context);
    if (required) throw new AdminAuthError(401);
    return null;
  }

  const { data: adminRow, error } = await serviceClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !adminRow) {
    clearAdminCookies(context);
    if (required) throw new AdminAuthError(403);
    return null;
  }

  return {
    accessToken,
    refreshToken,
    serviceClient,
    user,
    userClient: createAnonClient(accessToken)
  };
}

export async function requireAdminSession(context: AdminAuthContext) {
  const session = await getAdminSession(context, { required: true });
  if (!session) throw new AdminAuthError(401);
  return session;
}

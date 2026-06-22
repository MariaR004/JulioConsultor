import type { APIRoute } from "astro";
import { env as cloudflareEnv } from "cloudflare:workers";
import { AUTH_CAPTCHA_SITE_KEY } from "@/lib/env";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { createAnonClient, createServiceClient, setAdminCookies } from "@/lib/server/adminAuth";
import {
  adminLoginRateLimitKey,
  checkAdminLoginRateLimit,
  clearAdminLoginRateLimit,
  recordAdminLoginFailure,
  type RateLimitKv
} from "@/lib/server/adminRateLimit";
import { errorResponse, jsonResponse, readJsonObject } from "@/lib/server/adminResponses";
import { requiredCaptchaError } from "@/lib/server/adminValidation";

export const prerender = false;

function sessionKv() {
  return cloudflareEnv.SESSION as RateLimitKv | undefined;
}

function rateLimitResponse(retryAfterSeconds = 600) {
  return jsonResponse(
    { error: "Muitas tentativas. Aguarde antes de tentar novamente." },
    {
      status: 429,
      headers: {
        "retry-after": String(retryAfterSeconds)
      }
    }
  );
}

export const POST: APIRoute = async (context) => {
  const body = await readJsonObject(context.request);
  if (!body) return errorResponse(400);

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
  if (!email || !password) return errorResponse(400);
  const captchaError = requiredCaptchaError(AUTH_CAPTCHA_SITE_KEY, captchaToken);
  if (captchaError) return errorResponse(400, captchaError);

  try {
    const rateLimitKey = await adminLoginRateLimitKey(context.request, email);
    const currentLimit = await checkAdminLoginRateLimit(sessionKv(), rateLimitKey);
    if (currentLimit.limited) return rateLimitResponse(currentLimit.retryAfterSeconds);

    const anon = createAnonClient();
    const { data, error } = await anon.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined
    });

    if (error || !data.user || !data.session) {
      const failureLimit = await recordAdminLoginFailure(sessionKv(), rateLimitKey);
      if (failureLimit.limited) return rateLimitResponse(failureLimit.retryAfterSeconds);
      const status = error?.status === 429 ? 429 : 401;
      return errorResponse(
        status,
        status === 429
          ? "Muitas tentativas. Aguarde antes de tentar novamente."
          : "Credenciais inválidas."
      );
    }

    const serviceClient = createServiceClient();
    const { data: adminRow, error: adminError } = await serviceClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      const failureLimit = await recordAdminLoginFailure(sessionKv(), rateLimitKey);
      if (failureLimit.limited) return rateLimitResponse(failureLimit.retryAfterSeconds);
      await recordAdminEvent(serviceClient, {
        action: "admin_login_denied",
        actorUserId: data.user.id,
        entityId: data.user.id,
        entityType: "auth_user"
      });
      return errorResponse(403, "Usuário sem permissão administrativa.");
    }

    await clearAdminLoginRateLimit(sessionKv(), rateLimitKey);
    setAdminCookies(context, data.session);
    await recordAdminEvent(serviceClient, {
      action: "admin_login",
      actorUserId: data.user.id,
      entityId: data.user.id,
      entityType: "auth_user"
    });

    return jsonResponse({ isAdmin: true });
  } catch {
    return errorResponse(500, "Não foi possível autenticar.");
  }
};

import type { APIRoute } from "astro";
import { AUTH_CAPTCHA_SITE_KEY } from "@/lib/env";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, createAnonClient, requireAdminSession } from "@/lib/server/adminAuth";
import { errorResponse, jsonResponse, readJsonObject } from "@/lib/server/adminResponses";
import { requiredCaptchaError, validatePasswordChangePayload } from "@/lib/server/adminValidation";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);
    const parsed = validatePasswordChangePayload(await readJsonObject(context.request));
    if (parsed.error !== null) return errorResponse(400, parsed.error);
    const { currentPassword, newPassword, captchaToken } = parsed.value;
    const captchaError = requiredCaptchaError(AUTH_CAPTCHA_SITE_KEY, captchaToken);
    if (captchaError) return errorResponse(400, captchaError);

    const email = session.user.email || "";
    if (!email) return errorResponse(400, "Conta sem e-mail associado.");

    // 1) reautentica para confirmar a senha atual
    const anon = createAnonClient();
    const { error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: currentPassword,
      options: captchaToken ? { captchaToken } : undefined
    });
    if (signInError) {
      // Distingue falha do captcha de senha incorreta para não confundir o usuário.
      if (/captcha/i.test(signInError.message)) {
        return errorResponse(400, "Falha na verificação anti-robô. Recarregue e tente novamente.");
      }
      return errorResponse(400, "Senha atual incorreta.");
    }

    // 2) atualiza a senha via Admin API (service role). Não usamos
    // userClient.auth.updateUser porque esse cliente é stateless
    // (persistSession: false) e não tem sessão em memória — o updateUser
    // falharia com "Auth session missing!".
    const { error: updateError } = await session.serviceClient.auth.admin.updateUserById(
      session.user.id,
      { password: newPassword }
    );
    if (updateError) {
      const message = updateError.message || "";
      if (/leaked|pwned|weak|easy to guess|breach/i.test(message)) {
        return errorResponse(
          400,
          "Esta senha é muito comum ou apareceu em vazamentos. Escolha outra."
        );
      }
      if (/different from the old|should be different/i.test(message)) {
        return errorResponse(400, "A nova senha deve ser diferente da atual.");
      }
      console.error("admin password update failed:", message);
      return errorResponse(400, "Não foi possível alterar a senha. Tente novamente.");
    }

    await recordAdminEvent(session.serviceClient, {
      action: "admin_password_change",
      actorUserId: session.user.id,
      entityId: session.user.id,
      entityType: "auth_user"
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível alterar a senha.");
  }
};

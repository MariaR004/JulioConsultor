import type { APIRoute } from "astro";
import { clearAdminCookies, createAnonClient, getAdminSession } from "@/lib/server/adminAuth";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { jsonResponse } from "@/lib/server/adminResponses";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  try {
    const session = await getAdminSession(context, { required: false });
    if (session) {
      const anon = createAnonClient();
      await anon.auth
        .setSession({
          access_token: session.accessToken,
          refresh_token: session.refreshToken
        })
        .catch(() => null);
      await anon.auth.signOut().catch(() => null);
      await recordAdminEvent(session.serviceClient, {
        action: "admin_logout",
        actorUserId: session.user.id,
        entityId: session.user.id,
        entityType: "auth_user"
      });
    }
  } catch {
    console.warn("Ignoring invalid admin logout session.");
  }

  clearAdminCookies(context);
  return jsonResponse({ ok: true });
};

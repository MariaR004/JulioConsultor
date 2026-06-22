import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import { errorResponse, jsonResponse } from "@/lib/server/adminResponses";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);
    const { data, error } = await session.userClient.rpc("admin_usage_summary");
    if (error) return errorResponse(500, "Indicadores indisponíveis.");

    await recordAdminEvent(session.serviceClient, {
      action: "usage_summary_read",
      actorUserId: session.user.id,
      entityId: "admin_usage_summary",
      entityType: "rpc"
    });

    return jsonResponse({ usage: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Indicadores indisponíveis.");
  }
};

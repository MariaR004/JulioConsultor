import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import { errorResponse, jsonResponse, readJsonObject } from "@/lib/server/adminResponses";
import { validateContactPayload } from "@/lib/server/adminValidation";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);
    const { data, error } = await session.serviceClient
      .from("site_settings")
      .select("whatsapp, phone, email")
      .eq("id", "contact")
      .maybeSingle();
    if (error || !data) return errorResponse(500, "Não foi possível carregar contato.");
    return jsonResponse({ contact: data });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível carregar contato.");
  }
};

export const PATCH: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);
    const parsed = validateContactPayload(await readJsonObject(context.request));
    if (parsed.error !== null) return errorResponse(400, parsed.error);

    const { error } = await session.serviceClient
      .from("site_settings")
      .upsert({ id: "contact", ...parsed.value });
    if (error) return errorResponse(500, "Não foi possível salvar contato.");

    await recordAdminEvent(session.serviceClient, {
      action: "contact_update",
      actorUserId: session.user.id,
      entityId: "contact",
      entityType: "site_settings"
    });

    return jsonResponse({ contact: parsed.value });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível salvar contato.");
  }
};

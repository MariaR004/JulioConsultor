import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import {
  ADMIN_PROPERTY_SELECT,
  listStoragePaths,
  normalizePropertyPhotos,
  photoVariantPaths,
  removeStoragePaths
} from "@/lib/server/adminPhotos";
import { errorResponse, jsonResponse, readJsonObject } from "@/lib/server/adminResponses";
import { validatePropertyPayload } from "@/lib/server/adminValidation";

export const prerender = false;

function propertyId(context: Parameters<APIRoute>[0]) {
  return context.params.id || "";
}

export const PATCH: APIRoute = async (context) => {
  try {
    const id = propertyId(context);
    if (!id) return errorResponse(400);
    const session = await requireAdminSession(context);
    const body = await readJsonObject(context.request);
    const parsed = validatePropertyPayload(body, { partial: true });
    if (parsed.error !== null) return errorResponse(400, parsed.error);
    const payload = parsed.value;

    if (!Object.keys(payload).length) return errorResponse(400);

    if (payload.is_featured) {
      const { error: clearError } = await session.serviceClient
        .from("properties")
        .update({ is_featured: false })
        .neq("id", id);
      if (clearError) return errorResponse(500, "Não foi possível salvar imóvel.");
    }

    const { data, error } = await session.serviceClient
      .from("properties")
      .update(payload)
      .eq("id", id)
      .select(ADMIN_PROPERTY_SELECT)
      .single();

    if (error || !data) return errorResponse(500, "Não foi possível salvar imóvel.");
    await recordAdminEvent(session.serviceClient, {
      action: "property_update",
      actorUserId: session.user.id,
      entityId: id,
      entityType: "property",
      metadata: { fields: Object.keys(payload) }
    });

    return jsonResponse({ property: normalizePropertyPhotos(session.serviceClient, data) });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível salvar imóvel.");
  }
};

export const DELETE: APIRoute = async (context) => {
  try {
    const id = propertyId(context);
    if (!id) return errorResponse(400);
    const session = await requireAdminSession(context);

    const { data: photos, error: photosError } = await session.serviceClient
      .from("property_photos")
      .select("storage_path,thumb_path,card_path,full_path")
      .eq("property_id", id);
    if (photosError) return errorResponse(500, "Não foi possível remover imóvel.");

    const paths = [
      ...(photos || []).flatMap((photo) => photoVariantPaths(photo)),
      ...(await listStoragePaths(session.serviceClient, id))
    ];
    await removeStoragePaths(session.serviceClient, paths);

    const { error } = await session.serviceClient.from("properties").delete().eq("id", id);
    if (error) return errorResponse(500, "Não foi possível remover imóvel.");

    await recordAdminEvent(session.serviceClient, {
      action: "property_delete",
      actorUserId: session.user.id,
      entityId: id,
      entityType: "property"
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível remover imóvel.");
  }
};

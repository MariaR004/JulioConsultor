import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import { errorResponse, jsonResponse, readJsonObject } from "@/lib/server/adminResponses";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
  const id = context.params.id || "";
  if (!id) return errorResponse(400);

  try {
    const session = await requireAdminSession(context);
    const body = await readJsonObject(context.request);
    const photoIds = Array.isArray(body?.photoIds)
      ? body.photoIds.map((item) => String(item)).filter(Boolean)
      : [];
    if (!photoIds.length) return errorResponse(400, "Lista de fotos inválida.");

    const { data: photos, error: photosError } = await session.serviceClient
      .from("property_photos")
      .select("id")
      .eq("property_id", id)
      .in("id", photoIds);

    if (photosError || (photos || []).length !== photoIds.length) {
      return errorResponse(400, "Lista de fotos inválida.");
    }

    const updates = await Promise.all(
      photoIds.map((photoId, position) =>
        session.serviceClient.from("property_photos").update({ position }).eq("id", photoId)
      )
    );
    if (updates.some((update) => update.error)) {
      return errorResponse(500, "Não foi possível ordenar fotos.");
    }

    await recordAdminEvent(session.serviceClient, {
      action: "property_photo_reorder",
      actorUserId: session.user.id,
      entityId: id,
      entityType: "property",
      metadata: { photo_count: photoIds.length }
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível ordenar fotos.");
  }
};

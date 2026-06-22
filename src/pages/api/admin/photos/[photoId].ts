import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import { listStoragePaths, photoVariantPaths, removeStoragePaths } from "@/lib/server/adminPhotos";
import { errorResponse, jsonResponse } from "@/lib/server/adminResponses";

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
  const photoId = context.params.photoId || "";
  if (!photoId) return errorResponse(400);

  try {
    const session = await requireAdminSession(context);
    const { data: photo, error: photoError } = await session.serviceClient
      .from("property_photos")
      .select("id,property_id,storage_path,thumb_path,card_path,full_path")
      .eq("id", photoId)
      .maybeSingle();

    if (photoError || !photo) return errorResponse(404, "Foto não encontrada.");

    const folderPath = (photo.full_path || photo.storage_path || "").replace(/\/[^/]+$/, "");
    const paths = [
      ...photoVariantPaths(photo),
      ...(folderPath ? await listStoragePaths(session.serviceClient, folderPath) : [])
    ];
    await removeStoragePaths(session.serviceClient, paths);

    const { error } = await session.serviceClient
      .from("property_photos")
      .delete()
      .eq("id", photoId);
    if (error) return errorResponse(500, "Não foi possível remover foto.");

    await recordAdminEvent(session.serviceClient, {
      action: "property_photo_delete",
      actorUserId: session.user.id,
      entityId: photoId,
      entityType: "property_photo",
      metadata: { property_id: photo.property_id }
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível remover foto.");
  }
};

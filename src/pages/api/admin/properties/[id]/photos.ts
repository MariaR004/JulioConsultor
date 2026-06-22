import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import {
  PROPERTY_PHOTOS_BUCKET,
  normalizePhotoUrls,
  removeStoragePaths
} from "@/lib/server/adminPhotos";
import { errorResponse, jsonResponse } from "@/lib/server/adminResponses";
import { validateImageFile, validatePropertyPhotoLimit } from "@/lib/server/adminValidation";

export const prerender = false;

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return "webp";
}

export const POST: APIRoute = async (context) => {
  const id = context.params.id || "";
  if (!id) return errorResponse(400);

  try {
    const session = await requireAdminSession(context);
    const form = await context.request.formData();
    const thumb = form.get("thumb");
    const card = form.get("card");
    const full = form.get("full");

    for (const [label, value] of [
      ["thumb", thumb],
      ["card", card],
      ["full", full]
    ] as const) {
      const error = await validateImageFile(value, label);
      if (error) return errorResponse(400, error);
    }

    const { data: property, error: propertyError } = await session.serviceClient
      .from("properties")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (propertyError || !property) return errorResponse(404, "Imóvel não encontrado.");

    const { count: currentPhotoCount, error: photoCountError } = await session.serviceClient
      .from("property_photos")
      .select("id", { count: "exact", head: true })
      .eq("property_id", id);
    if (photoCountError) throw photoCountError;
    const photoLimitError = validatePropertyPhotoLimit(currentPhotoCount || 0);
    if (photoLimitError) return errorResponse(400, photoLimitError);

    const files = {
      thumb: thumb as File,
      card: card as File,
      full: full as File
    };
    const photoId = crypto.randomUUID();
    const paths = {
      thumb: `${id}/${photoId}/thumb.${extensionFor(files.thumb.type)}`,
      card: `${id}/${photoId}/card.${extensionFor(files.card.type)}`,
      full: `${id}/${photoId}/full.${extensionFor(files.full.type)}`
    };
    const uploadedPaths: string[] = [];

    try {
      for (const [variant, file] of Object.entries(files) as Array<[keyof typeof files, File]>) {
        const { error } = await session.serviceClient.storage
          .from(PROPERTY_PHOTOS_BUCKET)
          .upload(paths[variant], file, {
            cacheControl: "31536000",
            contentType: file.type,
            upsert: false
          });
        if (error) throw error;
        uploadedPaths.push(paths[variant]);
      }

      const rawPosition = Number(form.get("position") || 0);
      const { data, error } = await session.serviceClient
        .from("property_photos")
        .insert({
          alt: String(form.get("alt") || files.full.name).slice(0, 180),
          card_path: paths.card,
          full_path: paths.full,
          position: Number.isFinite(rawPosition) && rawPosition >= 0 ? Math.round(rawPosition) : 0,
          property_id: id,
          storage_path: paths.full,
          thumb_path: paths.thumb
        })
        .select(
          "id,property_id,storage_path,thumb_path,card_path,full_path,alt,position,created_at"
        )
        .single();

      if (error || !data) throw error || new Error("Photo insert failed");

      await recordAdminEvent(session.serviceClient, {
        action: "property_photo_upload",
        actorUserId: session.user.id,
        entityId: data.id,
        entityType: "property_photo",
        metadata: { property_id: id }
      });

      return jsonResponse(
        { photo: normalizePhotoUrls(session.serviceClient, data) },
        { status: 201 }
      );
    } catch (error) {
      await removeStoragePaths(session.serviceClient, uploadedPaths).catch(() => null);
      throw error;
    }
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível enviar foto.");
  }
};

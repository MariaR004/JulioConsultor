import type { APIRoute } from "astro";
import { recordAdminEvent } from "@/lib/server/adminAudit";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import { ADMIN_PROPERTY_SELECT, normalizePropertyPhotos } from "@/lib/server/adminPhotos";
import { errorResponse, jsonResponse, readJsonObject } from "@/lib/server/adminResponses";
import { validatePropertyPayload } from "@/lib/server/adminValidation";

export const prerender = false;

const MAX_PER_PAGE = 50;
const DEFAULT_PER_PAGE = 20;

export const GET: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);

    // Parâmetro ausente vira `null` -> `Number(null)` é 0 (finito), então é
    // preciso checar o valor cru antes de converter para não cair em perPage=1.
    const rawPage = context.url.searchParams.get("page");
    const rawPerPage = context.url.searchParams.get("per_page");
    const parsedPage = rawPage === null ? NaN : Number(rawPage);
    const parsedPerPage = rawPerPage === null ? NaN : Number(rawPerPage);
    const perPage =
      Number.isFinite(parsedPerPage) && parsedPerPage >= 1
        ? Math.min(Math.trunc(parsedPerPage), MAX_PER_PAGE)
        : DEFAULT_PER_PAGE;
    const page = Number.isFinite(parsedPage) ? Math.max(Math.trunc(parsedPage), 1) : 1;
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    const { data, error, count } = await session.serviceClient
      .from("properties")
      .select(ADMIN_PROPERTY_SELECT, { count: "exact" })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error || !data) return errorResponse(500, "Não foi possível carregar imóveis.");
    const total = count ?? 0;
    return jsonResponse({
      properties: data.map((property) => normalizePropertyPhotos(session.serviceClient, property)),
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage))
    });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível carregar imóveis.");
  }
};

export const POST: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);
    const body = await readJsonObject(context.request);
    const parsed = validatePropertyPayload(body, { partial: false });
    if (parsed.error !== null) return errorResponse(400, parsed.error);
    const payload = parsed.value;

    if (payload.is_featured) {
      const { error: clearError } = await session.serviceClient
        .from("properties")
        .update({ is_featured: false })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (clearError) return errorResponse(500, "Não foi possível salvar imóvel.");
    }

    const { data, error } = await session.serviceClient
      .from("properties")
      .insert(payload)
      .select(ADMIN_PROPERTY_SELECT)
      .single();

    if (error || !data) return errorResponse(500, "Não foi possível salvar imóvel.");
    await recordAdminEvent(session.serviceClient, {
      action: "property_create",
      actorUserId: session.user.id,
      entityId: data.id,
      entityType: "property",
      metadata: { is_featured: Boolean(data.is_featured) }
    });

    return jsonResponse(
      { property: normalizePropertyPhotos(session.serviceClient, data) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não foi possível salvar imóvel.");
  }
};

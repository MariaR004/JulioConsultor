import type { APIRoute } from "astro";
import { AdminAuthError, requireAdminSession } from "@/lib/server/adminAuth";
import { errorResponse, jsonResponse } from "@/lib/server/adminResponses";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const session = await requireAdminSession(context);
    return jsonResponse({
      email: session.user.email || "",
      isAdmin: true
    });
  } catch (error) {
    if (error instanceof AdminAuthError) return errorResponse(error.status, "Não autorizado.");
    return errorResponse(500, "Não autorizado.");
  }
};

import type { APIRoute } from "astro";
import {
  ERROR_CACHE_CONTROL,
  PUBLIC_CACHE_CONTROL,
  getPublicPropertyData
} from "@/lib/server/publicData";
import { safeJsonScript } from "@/lib/safeJson";

export const prerender = false;

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(safeJsonScript(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const data = await getPublicPropertyData({
      id: url.searchParams.get("id"),
      slug: url.searchParams.get("slug")
    });

    return json(data, {
      status: data.property ? 200 : 404,
      headers: {
        "cache-control": data.property ? PUBLIC_CACHE_CONTROL : ERROR_CACHE_CONTROL
      }
    });
  } catch (error) {
    console.error("public property-data failed:", error);
    return json(
      { error: "Nao foi possivel carregar os dados do imovel." },
      {
        status: 503,
        headers: {
          "cache-control": ERROR_CACHE_CONTROL
        }
      }
    );
  }
};

import type { APIRoute } from "astro";
import {
  ERROR_CACHE_CONTROL,
  PUBLIC_CACHE_CONTROL,
  getPublicHomeData
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

export const GET: APIRoute = async () => {
  try {
    return json(await getPublicHomeData(), {
      headers: {
        "cache-control": PUBLIC_CACHE_CONTROL
      }
    });
  } catch (error) {
    console.error("public home-data failed:", error);
    return json(
      { error: "Nao foi possivel carregar os dados publicos." },
      {
        status: 503,
        headers: {
          "cache-control": ERROR_CACHE_CONTROL
        }
      }
    );
  }
};

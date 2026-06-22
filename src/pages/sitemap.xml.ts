import type { APIRoute } from "astro";
import { getPublicProperties } from "@/lib/propertyData";
import { SITE_ORIGIN } from "@/lib/env";

// Renderizado no servidor para listar também os imóveis cadastrados após o
// último deploy. O cache de 1 hora evita consultas repetidas ao Supabase.
export const prerender = false;

export const GET: APIRoute = async (context) => {
  const origin = (context.site ?? new URL(SITE_ORIGIN)).origin;
  const properties = await getPublicProperties();

  const entries = [
    { loc: `${origin}/`, priority: "1.0" },
    ...properties.map((property) => ({
      loc: `${origin}/imovel/${property.slug || property.id}`,
      priority: "0.8"
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => `  <url><loc>${entry.loc}</loc><priority>${entry.priority}</priority></url>`)
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
};

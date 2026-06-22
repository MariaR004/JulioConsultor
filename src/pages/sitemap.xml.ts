import type { APIRoute } from "astro";
import { getPublicProperties } from "@/lib/propertyData";
import { SITE_ORIGIN } from "@/lib/env";

// Renderizado no servidor para listar também os imóveis cadastrados após o
// último deploy. O cache de 1 hora evita consultas repetidas ao Supabase.
export const prerender = false;

// Converte um timestamp do banco para o formato de data W3C (YYYY-MM-DD)
// aceito pelo protocolo de sitemaps. Retorna null se a data for inválida.
function toLastmod(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export const GET: APIRoute = async (context) => {
  const origin = (context.site ?? new URL(SITE_ORIGIN)).origin;
  const properties = await getPublicProperties();

  // lastmod da home = data de modificação mais recente entre os imóveis,
  // já que a home lista os imóveis.
  const propertyLastmods = properties
    .map((property) => toLastmod(property.updated_at || property.created_at))
    .filter((value): value is string => Boolean(value));
  const homeLastmod = propertyLastmods.length
    ? (propertyLastmods.slice().sort().at(-1) ?? null)
    : null;

  const entries = [
    { loc: `${origin}/`, priority: "1.0", lastmod: homeLastmod },
    ...properties.map((property) => ({
      loc: `${origin}/imovel/${property.slug || property.id}`,
      priority: "0.8",
      lastmod: toLastmod(property.updated_at || property.created_at)
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) =>
      `  <url><loc>${entry.loc}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ""}<priority>${entry.priority}</priority></url>`
  )
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

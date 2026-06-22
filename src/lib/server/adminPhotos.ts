import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property, PropertyPhoto } from "@/types";

export const PROPERTY_PHOTOS_BUCKET = "property-photos";

export const PROPERTY_PHOTO_SELECT =
  "id,property_id,storage_path,thumb_path,card_path,full_path,alt,position,created_at";

export const ADMIN_PROPERTY_SELECT = `
  id,
  slug,
  title,
  deal_type,
  price_cents,
  street,
  number,
  neighborhood,
  city,
  state,
  postal_code,
  bedrooms,
  suites,
  bathrooms,
  parking_spaces,
  area_m2,
  description,
  features,
  solar_kwh_month,
  is_featured,
  sort_order,
  created_at,
  updated_at,
  photos:property_photos(${PROPERTY_PHOTO_SELECT})
`;

export function publicPhotoUrl(client: SupabaseClient, path: string) {
  return client.storage.from(PROPERTY_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function normalizePhotoUrls<T extends PropertyPhoto>(client: SupabaseClient, photo: T): T {
  const fullPath = photo.full_path || photo.storage_path;
  const fullUrl = photo.url || (fullPath ? publicPhotoUrl(client, fullPath) : "");
  const base = photo.storage_path?.endsWith("/full.webp")
    ? photo.storage_path.slice(0, -"/full.webp".length)
    : "";

  return {
    ...photo,
    url: fullUrl,
    thumb_url: photo.thumb_path
      ? publicPhotoUrl(client, photo.thumb_path)
      : base
        ? publicPhotoUrl(client, `${base}/thumb.webp`)
        : fullUrl,
    card_url: photo.card_path
      ? publicPhotoUrl(client, photo.card_path)
      : base
        ? publicPhotoUrl(client, `${base}/card.webp`)
        : fullUrl,
    full_url: fullPath ? publicPhotoUrl(client, fullPath) : fullUrl
  };
}

export function normalizePropertyPhotos(client: SupabaseClient, property: Property): Property {
  return {
    ...property,
    photos: (property.photos || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((photo) => normalizePhotoUrls(client, photo))
  };
}

export function uniquePaths(paths: Array<string | null | undefined>) {
  return Array.from(new Set(paths.filter(Boolean))) as string[];
}

export function photoVariantPaths(photo: {
  storage_path?: string | null;
  thumb_path?: string | null;
  card_path?: string | null;
  full_path?: string | null;
}) {
  const explicitPaths = uniquePaths([
    photo.thumb_path,
    photo.card_path,
    photo.full_path,
    photo.storage_path
  ]);
  if (explicitPaths.length > 1 || !photo.storage_path?.endsWith("/full.webp")) return explicitPaths;
  const base = photo.storage_path.slice(0, -"/full.webp".length);
  return uniquePaths([`${base}/thumb.webp`, `${base}/card.webp`, `${base}/full.webp`]);
}

export async function listStoragePaths(client: SupabaseClient, prefix: string): Promise<string[]> {
  if (!prefix) return [];
  const bucket = client.storage.from(PROPERTY_PHOTOS_BUCKET);
  const paths: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await bucket.list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const item of data) {
      const childPath = `${prefix}/${item.name}`;
      if (!item.id && !item.metadata) {
        paths.push(...(await listStoragePaths(client, childPath)));
      } else {
        paths.push(childPath);
      }
    }

    if (data.length < limit) break;
    offset += data.length;
  }

  return paths;
}

export async function removeStoragePaths(client: SupabaseClient, paths: string[]) {
  const unique = uniquePaths(paths);
  if (!unique.length) return;
  const { error } = await client.storage.from(PROPERTY_PHOTOS_BUCKET).remove(unique);
  if (error) throw error;
}

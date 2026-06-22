import type { ContactSettings, Property, PropertyPhoto } from "@/types";
import { fallbackContact, fallbackProperties } from "@/data/fallback";
import { DEFAULT_CONTACT, slugify } from "@/lib/format";
import { PROPERTY_PHOTOS_BUCKET, supabase } from "@/lib/supabase";

const PUBLIC_PROPERTY_SELECT = `
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
  photos:property_photos(
    id,
    property_id,
    storage_path,
    thumb_path,
    card_path,
    full_path,
    alt,
    position
  )
`;

function normalizePhoto(photo: PropertyPhoto): PropertyPhoto {
  if (!photo.storage_path || !supabase) return photo;
  const storage = supabase.storage.from(PROPERTY_PHOTOS_BUCKET);
  const fullPath = photo.full_path || photo.storage_path;
  const fullUrl = photo.url || storage.getPublicUrl(fullPath).data.publicUrl;
  const variantBase = photo.storage_path.endsWith("/full.webp")
    ? photo.storage_path.slice(0, -"/full.webp".length)
    : "";
  const variantUrl = (path: string | null | undefined, name: "thumb" | "card" | "full") => {
    if (path) return storage.getPublicUrl(path).data.publicUrl;
    if (!variantBase) return fullUrl;
    return storage.getPublicUrl(`${variantBase}/${name}.webp`).data.publicUrl;
  };

  return {
    ...photo,
    url: fullUrl,
    thumb_url: photo.thumb_url || variantUrl(photo.thumb_path, "thumb"),
    card_url: photo.card_url || variantUrl(photo.card_path, "card"),
    full_url: photo.full_url || variantUrl(photo.full_path, "full")
  };
}

function withNormalizedPhotos(property: Property): Property {
  return {
    ...property,
    photos: (property.photos || []).map(normalizePhoto).sort((a, b) => a.position - b.position)
  };
}

export function primaryPhoto(property: Property) {
  return property.photos?.[0]?.url || "/img/casa1.jpeg";
}

export async function getPublicProperties(): Promise<Property[]> {
  if (!supabase) {
    if (import.meta.env.PROD) {
      throw new Error("Supabase não está configurado. Verifique as chaves e a conexão.");
    }
    return fallbackProperties;
  }

  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT)
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data) {
    console.warn("Falha ao carregar imóveis publicados:", error);
    if (import.meta.env.PROD) {
      throw new Error(
        `Erro de conexão com o Supabase ao carregar imóveis: ${error?.message || "Sem dados"}`
      );
    }
    return fallbackProperties;
  }

  return data.map(withNormalizedPhotos);
}

export async function getPropertyById(id: string): Promise<Property | null> {
  if (!id) return null;
  if (!supabase) {
    if (import.meta.env.PROD) {
      throw new Error("Supabase não está configurado. Verifique as chaves e a conexão.");
    }
    return fallbackProperties.find((property) => property.id === id) || null;
  }

  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Falha ao carregar imóvel:", error);
    if (import.meta.env.PROD) {
      throw new Error(`Erro de conexão com o Supabase ao carregar imóvel ${id}: ${error.message}`);
    }
    return null;
  }

  if (!data) return null;

  return withNormalizedPhotos(data);
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  if (!slug) return null;
  if (!supabase) {
    if (import.meta.env.PROD) {
      throw new Error("Supabase não está configurado. Verifique as chaves e a conexão.");
    }
    return (
      fallbackProperties.find((property) => (property.slug || slugify(property.title)) === slug) ||
      null
    );
  }

  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.warn("Falha ao carregar imóvel por slug:", error);
    if (import.meta.env.PROD) {
      throw new Error(
        `Erro de conexão com o Supabase ao carregar imóvel ${slug}: ${error.message}`
      );
    }
    return null;
  }

  if (!data) return null;

  return withNormalizedPhotos(data);
}

export async function getContactSettings(): Promise<ContactSettings> {
  if (!supabase) {
    if (import.meta.env.PROD) {
      throw new Error("Supabase não está configurado. Verifique as chaves e a conexão.");
    }
    return fallbackContact;
  }

  const { data, error } = await supabase
    .from("site_settings")
    .select("whatsapp, phone, email")
    .eq("id", "contact")
    .maybeSingle();

  if (error || !data) {
    console.warn("Falha ao carregar contato:", error);
    if (import.meta.env.PROD) {
      throw new Error(
        `Erro de conexão com o Supabase ao carregar contato: ${error?.message || "Sem dados"}`
      );
    }
    return DEFAULT_CONTACT;
  }

  return {
    whatsapp: data.whatsapp || DEFAULT_CONTACT.whatsapp,
    phone: data.phone || DEFAULT_CONTACT.phone,
    email: data.email || DEFAULT_CONTACT.email
  };
}

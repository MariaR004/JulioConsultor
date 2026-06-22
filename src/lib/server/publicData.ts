import type { ContactSettings, Property } from "@/types";
import {
  getContactSettings,
  getPropertyById,
  getPropertyBySlug,
  getPublicProperties
} from "@/lib/propertyData";
import {
  normalizeContact,
  toLegacyProperties,
  toLegacyProperty,
  type LegacyProperty
} from "@/lib/viewModel";

export const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=600";
export const ERROR_CACHE_CONTROL = "no-store";

export type PublicHomeData = {
  properties: LegacyProperty[];
  contact: ContactSettings;
};

export type PublicPropertyData = {
  property: LegacyProperty | null;
  contact: ContactSettings;
};

export function toPublicHomeData(
  properties: Property[],
  contact: Partial<ContactSettings> | null | undefined
): PublicHomeData {
  return {
    properties: toLegacyProperties(properties),
    contact: normalizeContact(contact)
  };
}

export function toPublicPropertyData(
  property: Property | null,
  contact: Partial<ContactSettings> | null | undefined
): PublicPropertyData {
  return {
    property: property ? toLegacyProperty(property) : null,
    contact: normalizeContact(contact)
  };
}

async function findPublicProperty(options: { id?: string | null; slug?: string | null }) {
  const id = (options.id || "").trim();
  const slug = (options.slug || "").trim();
  if (id) return getPropertyById(id);
  if (slug) return getPropertyBySlug(slug);

  const properties = await getPublicProperties();
  return properties.find((property) => property.is_featured) || properties[0] || null;
}

export async function getPublicHomeData(): Promise<PublicHomeData> {
  const [properties, contact] = await Promise.all([getPublicProperties(), getContactSettings()]);
  return toPublicHomeData(properties, contact);
}

export async function getPublicPropertyData(options: {
  id?: string | null;
  slug?: string | null;
}): Promise<PublicPropertyData> {
  const [property, contact] = await Promise.all([
    findPublicProperty(options),
    getContactSettings()
  ]);
  return toPublicPropertyData(property, contact);
}

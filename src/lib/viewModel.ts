import type { ContactSettings, DealType, Property, PropertyPhoto } from "@/types";
import { DEFAULT_CONTACT, cleanPhone, formatAddress, formatCurrency, slugify } from "@/lib/format";

export const PUBLIC_PHOTO_FALLBACK = "/img/casa1.jpeg";

export type LegacyProperty = {
  id: string;
  slug: string;
  title: string;
  street: string;
  number: string;
  city: string;
  state: string;
  neighborhood: string;
  location: string;
  postalCode: string;
  price: string;
  type: "Venda" | "Aluguel";
  tag: "Venda" | "Aluguel";
  priceNote: "Venda" | "Aluguel";
  beds: number;
  suites: number;
  baths: number;
  parking: number;
  area: number;
  description: string;
  features: string[];
  solarKwhMonth: number;
  photos: string[];
  photoThumbs: string[];
  photoCards: string[];
  photoFull: string[];
  photoRecords: PropertyPhoto[];
  img: string;
  isFeatured: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function dealTypeToLabel(type: DealType | string | null | undefined): "Venda" | "Aluguel" {
  return type === "rent" || type === "Aluguel" ? "Aluguel" : "Venda";
}

export function legacyToDealType(type: string): DealType {
  return type === "Aluguel" || type === "rent" ? "rent" : "sale";
}

function primaryPhoto(property: Property) {
  return property.photos?.[0]?.url || PUBLIC_PHOTO_FALLBACK;
}

export function toLegacyProperty(property: Property): LegacyProperty {
  const type = dealTypeToLabel(property.deal_type);
  const photos = (property.photos || [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((photo) => photo.url || "")
    .filter(Boolean);
  if (!photos.length) photos.push(primaryPhoto(property));
  const sortedPhotos = (property.photos || []).slice().sort((a, b) => a.position - b.position);
  const photoThumbs = sortedPhotos
    .map((photo) => photo.thumb_url || photo.url || "")
    .filter(Boolean);
  const photoCards = sortedPhotos.map((photo) => photo.card_url || photo.url || "").filter(Boolean);
  const photoFull = sortedPhotos.map((photo) => photo.full_url || photo.url || "").filter(Boolean);

  return {
    id: property.id,
    slug: property.slug || slugify(property.title) || property.id,
    title: property.title || "Imóvel sem título",
    street: property.street || "",
    number: property.number || "",
    city: property.city || "Cuiabá",
    state: property.state || "MT",
    neighborhood: property.neighborhood || "",
    location: formatAddress(property).replace(" - MT", " — MT"),
    postalCode: property.postal_code || "",
    price: formatCurrency(property.price_cents, property.deal_type),
    type,
    tag: type,
    priceNote: type,
    beds: Number(property.bedrooms || 0),
    suites: Number(property.suites || 0),
    baths: Number(property.bathrooms || 0),
    parking: Number(property.parking_spaces || 0),
    area: Number(property.area_m2 || 0),
    description: property.description || "",
    features: property.features || [],
    solarKwhMonth: Number(property.solar_kwh_month || 0),
    photos,
    photoThumbs: photoThumbs.length ? photoThumbs : photos,
    photoCards: photoCards.length ? photoCards : photos,
    photoFull: photoFull.length ? photoFull : photos,
    photoRecords: property.photos || [],
    img: photos[0] || primaryPhoto(property),
    isFeatured: Boolean(property.is_featured),
    sortOrder: Number(property.sort_order || 0),
    createdAt: property.created_at || "",
    updatedAt: property.updated_at || ""
  };
}

export function toLegacyProperties(properties: Property[]) {
  return properties.map(toLegacyProperty);
}

function normalizeFeatureName(value: string) {
  const clean = String(value || "").trim();
  const key = clean
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (key === "placa solar" || key === "painel solar") return "Painel solar";
  return clean;
}

export function publicFeatureLabels(property: Pick<LegacyProperty, "features" | "solarKwhMonth">) {
  const items = property.features?.length
    ? property.features
    : ["Fale com o Júlio para conhecer os diferenciais."];
  const solarKwhMonth = Number(property.solarKwhMonth || 0);

  if (solarKwhMonth > 0) {
    return items.map((feature) =>
      normalizeFeatureName(feature).toLowerCase() === "painel solar"
        ? `Painel solar - ${solarKwhMonth} kWh/mês`
        : feature
    );
  }

  return items.filter((feature) => normalizeFeatureName(feature).toLowerCase() !== "painel solar");
}

export function normalizeContact(
  contact: Partial<ContactSettings> | null | undefined
): ContactSettings {
  return {
    whatsapp: cleanPhone(contact?.whatsapp || DEFAULT_CONTACT.whatsapp),
    phone: cleanPhone(contact?.phone || DEFAULT_CONTACT.phone),
    email: contact?.email || DEFAULT_CONTACT.email
  };
}

export function legacyWhatsappBase(contact: ContactSettings) {
  return `https://wa.me/${cleanPhone(contact.whatsapp || DEFAULT_CONTACT.whatsapp)}`;
}

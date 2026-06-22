export type DealType = "sale" | "rent";

export type ContactSettings = {
  whatsapp: string;
  phone: string;
  email: string;
};

export type PropertyPhoto = {
  id?: string;
  property_id?: string;
  storage_path?: string | null;
  thumb_path?: string | null;
  card_path?: string | null;
  full_path?: string | null;
  url?: string | null;
  thumb_url?: string | null;
  card_url?: string | null;
  full_url?: string | null;
  alt?: string | null;
  position: number;
};

export type Property = {
  id: string;
  slug?: string | null;
  title: string;
  deal_type: DealType;
  price_cents: number | null;
  street: string | null;
  number: string | null;
  neighborhood: string;
  city: string;
  state: string;
  postal_code: string | null;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parking_spaces: number;
  area_m2: number | null;
  description: string | null;
  features: string[];
  solar_kwh_month: number | null;
  is_featured: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  photos?: PropertyPhoto[];
};

export type PropertyPayload = Omit<
  Property,
  "id" | "slug" | "created_at" | "updated_at" | "photos"
> & {
  id?: string;
};

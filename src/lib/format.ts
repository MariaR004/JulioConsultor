import type { ContactSettings, DealType, Property } from "@/types";

export function cleanPhone(value: string | null | undefined) {
  return String(value || "").replace(/\D/g, "");
}

// Gera um slug legível para a URL (minúsculo, sem acentos, com hífens).
// Espelha public.slugify do schema.sql; usado como fallback quando o banco
// não devolve o slug (ex.: dados de demonstração no dev).
export function slugify(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function whatsappUrl(phone: string, text: string) {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function formatPhone(value: string | null | undefined) {
  const digits = cleanPhone(value);
  if (digits.length === 13 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return value || "";
}

export function formatCurrency(cents: number | null | undefined, dealType?: DealType) {
  if (!cents) return "Valor sob consulta";
  const value = (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  });
  return dealType === "rent" ? `${value} / mês` : value;
}

export function parseCurrencyToCents(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits) * 100;
}

export function formatAddress(
  property: Pick<Property, "neighborhood" | "city" | "state" | "street" | "number">
) {
  const street = [property.street, property.number].filter(Boolean).join(", ");
  const area = [property.neighborhood, property.city].filter(Boolean).join(", ");
  return [street, area, property.state].filter(Boolean).join(" - ");
}

export function dealLabel(type: DealType) {
  return type === "rent" ? "Aluguel" : "Venda";
}

export function propertyWhatsappText(property: Property) {
  return `Olá Júlio, vi o imóvel "${property.title}" no site e tenho interesse.`;
}

export function defaultWhatsappText() {
  return "Olá Júlio, vi seu site e tenho interesse em um imóvel.";
}

export const DEFAULT_CONTACT: ContactSettings = {
  whatsapp: "556596052977",
  phone: "556536661989",
  email: "julioimoveis1@hotmail.com"
};

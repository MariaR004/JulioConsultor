import type { ContactSettings, PropertyPayload } from "@/types";
import { cleanPhone } from "@/lib/format";
import { passwordPolicyError } from "@/lib/passwordPolicy";
import { MAX_PROPERTY_PHOTOS } from "@/lib/photoLimits";

type ValidationResult<T> =
  | { error: string; value?: undefined }
  | {
      error: null;
      value: T;
    };

export { MAX_PROPERTY_PHOTOS };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function optionalText(
  raw: Record<string, unknown>,
  key: string,
  maxLength: number,
  options: { nullable?: boolean; required?: boolean } = {}
) {
  if (!(key in raw)) {
    if (options.required) return { error: `${key} é obrigatório.` };
    return { present: false as const };
  }
  const value = raw[key];
  if ((value === null || value === "") && options.nullable) {
    if (options.required) return { error: `${key} é obrigatório.` };
    return { present: true as const, value: null };
  }
  if (typeof value !== "string") return { error: `${key} inválido.` };
  const trimmed = value.trim();
  if (options.required && !trimmed) return { error: `${key} é obrigatório.` };
  if (trimmed.length > maxLength) return { error: `${key} excede o limite.` };
  return { present: true as const, value: trimmed || (options.nullable ? null : "") };
}

function optionalInteger(
  raw: Record<string, unknown>,
  key: string,
  options: { min?: number; nullable?: boolean; required?: boolean } = {}
) {
  if (!(key in raw)) {
    if (options.required) return { error: `${key} é obrigatório.` };
    return { present: false as const };
  }
  const value = raw[key];
  if ((value === null || value === "") && options.nullable) {
    if (options.required) return { error: `${key} é obrigatório.` };
    return { present: true as const, value: null };
  }
  if (typeof value !== "number" || !Number.isInteger(value)) return { error: `${key} inválido.` };
  if (options.min !== undefined && value < options.min) return { error: `${key} inválido.` };
  return { present: true as const, value };
}

function optionalNumber(raw: Record<string, unknown>, key: string) {
  if (!(key in raw)) return { present: false as const };
  const value = raw[key];
  if (value === null || value === "") return { present: true as const, value: null };
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return { error: `${key} inválido.` };
  }
  return { present: true as const, value };
}

function assignIfPresent<T extends object, K extends keyof T>(
  target: T,
  key: K,
  parsed: { present: false } | { present: true; value: T[K] } | { error: string }
) {
  if ("error" in parsed) return parsed.error;
  if (parsed.present) target[key] = parsed.value;
  return "";
}

export function validatePropertyPayload(
  raw: unknown,
  options: { partial?: boolean } = {}
): ValidationResult<Partial<PropertyPayload>> {
  if (!isRecord(raw)) return { error: "Payload inválido." };

  const partial = Boolean(options.partial);
  const payload: Partial<PropertyPayload> = {};

  const textFields = [
    ["title", 120, false],
    ["street", 150, true],
    ["number", 20, true],
    ["neighborhood", 80, false],
    ["city", 80, false],
    ["postal_code", 15, true],
    ["description", 6000, true]
  ] as const;

  for (const [key, limit, nullable] of textFields) {
    const required = !partial && ["title", "neighborhood", "city"].includes(key);
    const error = assignIfPresent(
      payload,
      key,
      optionalText(raw, key, limit, { nullable, required }) as never
    );
    if (error) return { error };
  }

  if ("state" in raw) {
    const parsed = optionalText(raw, "state", 2, { required: !partial });
    if ("error" in parsed) return { error: parsed.error || "UF inválida." };
    if (parsed.present) {
      const state = String(parsed.value || "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(state)) return { error: "UF inválida." };
      payload.state = state;
    }
  } else if (!partial) {
    return { error: "state é obrigatório." };
  }

  if ("deal_type" in raw) {
    if (raw.deal_type !== "sale" && raw.deal_type !== "rent") {
      return { error: "Tipo de negócio inválido." };
    }
    payload.deal_type = raw.deal_type;
  } else if (!partial) {
    return { error: "deal_type é obrigatório." };
  }

  const integerFields = [
    "price_cents",
    "bedrooms",
    "suites",
    "bathrooms",
    "parking_spaces",
    "solar_kwh_month",
    "sort_order"
  ] as const;

  for (const key of integerFields) {
    const nullable = key === "price_cents" || key === "solar_kwh_month";
    const required = !partial && key !== "solar_kwh_month";
    const min = key === "sort_order" ? 0 : 0;
    const error = assignIfPresent(
      payload,
      key,
      optionalInteger(raw, key, { min, nullable, required }) as never
    );
    if (error) return { error };
  }

  if (!partial && (!payload.price_cents || payload.price_cents <= 0)) {
    return { error: "Preço obrigatório." };
  }

  const areaError = assignIfPresent(payload, "area_m2", optionalNumber(raw, "area_m2") as never);
  if (areaError) return { error: areaError };

  if ("features" in raw) {
    if (!Array.isArray(raw.features)) return { error: "features inválido." };
    if (raw.features.length > 25) return { error: "Limite de características excedido." };
    const features = raw.features.map((item) => String(item || "").trim()).filter(Boolean);
    if (features.some((item) => item.length > 80)) return { error: "Característica muito longa." };
    payload.features = Array.from(new Set(features));
  } else if (!partial) {
    payload.features = [];
  }

  if ("is_featured" in raw) {
    if (typeof raw.is_featured !== "boolean") return { error: "is_featured inválido." };
    payload.is_featured = raw.is_featured;
  } else if (!partial) {
    payload.is_featured = false;
  }

  if (
    typeof payload.suites === "number" &&
    typeof payload.bedrooms === "number" &&
    payload.suites > payload.bedrooms
  ) {
    return { error: "O número de suítes não pode ser maior que quartos." };
  }

  return { error: null, value: payload };
}

export function validateContactPayload(raw: unknown): ValidationResult<ContactSettings> {
  if (!isRecord(raw)) return { error: "Payload inválido." };
  const whatsapp = cleanPhone(String(raw.whatsapp || ""));
  const phone = cleanPhone(String(raw.phone || ""));
  const email = String(raw.email || "").trim();

  if (whatsapp.length < 10 || whatsapp.length > 20) return { error: "WhatsApp inválido." };
  if (phone.length < 8 || phone.length > 20) return { error: "Telefone inválido." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return { error: "E-mail inválido." };
  }

  return { error: null, value: { whatsapp, phone, email } };
}

export function validatePasswordChangePayload(raw: unknown): ValidationResult<{
  currentPassword: string;
  newPassword: string;
  captchaToken: string;
}> {
  if (!isRecord(raw)) return { error: "Payload inválido." };

  const currentPassword = typeof raw.currentPassword === "string" ? raw.currentPassword : "";
  const newPassword = typeof raw.newPassword === "string" ? raw.newPassword : "";
  const captchaToken = typeof raw.captchaToken === "string" ? raw.captchaToken : "";

  if (!currentPassword) return { error: "Informe a senha atual." };
  const policyError = passwordPolicyError(newPassword);
  if (policyError) return { error: policyError };
  if (newPassword === currentPassword) {
    return { error: "A nova senha deve ser diferente da atual." };
  }

  return { error: null, value: { currentPassword, newPassword, captchaToken } };
}

export function requiredCaptchaError(siteKey: string, captchaToken: string) {
  if (siteKey && !captchaToken.trim()) {
    return "Verificação anti-robô obrigatória. Recarregue e tente novamente.";
  }
  return "";
}

export function validatePropertyPhotoLimit(currentCount: number) {
  if (currentCount >= MAX_PROPERTY_PHOTOS) {
    return `Limite de ${MAX_PROPERTY_PHOTOS} fotos por imóvel atingido.`;
  }
  return "";
}

function detectImageMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return "";
}

export async function validateImageFile(value: FormDataEntryValue | null, label: string) {
  if (typeof File === "undefined" || !(value instanceof File)) return `${label} ausente.`;
  const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowed.has(value.type)) return `${label} tem tipo inválido.`;
  if (value.size <= 0 || value.size > 10 * 1024 * 1024) return `${label} excede o limite.`;
  const bytes = new Uint8Array(await value.slice(0, 12).arrayBuffer());
  if (detectImageMime(bytes) !== value.type) return `${label} tem conteúdo inválido.`;
  return "";
}

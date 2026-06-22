import type { Property } from "@/types";
import type { LegacyProperty } from "@/lib/viewModel";
export { MAX_PROPERTY_PHOTOS } from "@/lib/photoLimits";

export type DraftPhoto = {
  id?: string;
  storage_path?: string | null;
  thumb_path?: string | null;
  card_path?: string | null;
  full_path?: string | null;
  url: string;
  thumb_url?: string | null;
  card_url?: string | null;
  full_url?: string | null;
  alt?: string | null;
  position: number;
  file?: File;
};

export const PROPERTY_PHOTOS_BUCKET = "property-photos";
export const LOGIN_GUARD_STORAGE_KEY = "julio-admin-login-guard";
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 10 * 60 * 1000;
export const PROPERTIES_PER_PAGE = 20;
export const MEASURE_FIELD_IDS = [
  "propertyBeds",
  "propertySuites",
  "propertyBaths",
  "propertyParking",
  "propertyArea"
];

const DEFAULT_FEATURE_OPTIONS = [
  "Painel solar",
  "Garagem coberta",
  "Piscina",
  "Câmeras de segurança",
  "Cerca elétrica",
  "Área gourmet",
  "Quintal",
  "Cozinha planejada",
  "Escriturada",
  "Elevador",
  "Sacada",
  "Condomínio"
];

type AdminState = {
  properties: Property[];
  legacyProperties: LegacyProperty[];
  isAdmin: boolean;
  photoDrafts: DraftPhoto[];
  draggedPhotoIndex: number | null;
  captchaToken: string;
  captchaWidgetId: string | null;
  passwordCaptchaToken: string;
  passwordCaptchaWidgetId: string | null;
  currentPage: number;
  totalPages: number;
  totalProperties: number;
  featureOptions: string[];
};

/**
 * Estado mutável compartilhado entre os módulos do painel admin.
 * Usamos um objeto singleton porque bindings de ES modules são read-only
 * de fora: reatribuir um `let` exportado não propaga para os importadores.
 */
export const state: AdminState = {
  properties: [],
  legacyProperties: [],
  isAdmin: false,
  photoDrafts: [],
  draggedPhotoIndex: null,
  captchaToken: "",
  captchaWidgetId: null,
  passwordCaptchaToken: "",
  passwordCaptchaWidgetId: null,
  currentPage: 1,
  totalPages: 1,
  totalProperties: 0,
  featureOptions: [...DEFAULT_FEATURE_OPTIONS]
};

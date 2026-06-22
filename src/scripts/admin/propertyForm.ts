import type { PropertyPayload } from "@/types";
import { parseCurrencyToCents } from "@/lib/format";
import { legacyToDealType, toLegacyProperty } from "@/lib/viewModel";
import { byId, escapeHtml, setStatus } from "../dom";
import { adminJson } from "./api";
import { input, setActiveTab, showToast, textarea } from "./ui";
import { MAX_PROPERTY_PHOTOS, MEASURE_FIELD_IDS, state } from "./state";
import { renderPhotoList, uploadAndSyncPhotos } from "./photos";
import { loadProperties } from "./propertyList";

function propertyTypeValue() {
  return input("propertyType").value || "Venda";
}

function setPropertySaveLoading(isLoading: boolean) {
  const submit = byId<HTMLButtonElement>("propertySubmitBtn");
  if (!submit) return;
  submit.disabled = isLoading;
  submit.classList.toggle("is-loading", isLoading);
  submit.setAttribute("aria-busy", String(isLoading));
  submit.textContent = isLoading ? "Salvando..." : "Salvar imóvel";
}

function normalizeMeasureField(field: HTMLInputElement, restoreEmpty = false) {
  const raw = field.value.replace(",", ".").trim();
  if (!raw) {
    field.value = restoreEmpty ? "0" : "";
    return;
  }
  const [integerPart, decimalPart] = raw.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  field.value =
    decimalPart === undefined ? normalizedInteger : `${normalizedInteger}.${decimalPart}`;
}

export function bindMeasureNumberFields() {
  MEASURE_FIELD_IDS.forEach((id) => {
    const field = byId<HTMLInputElement>(id);
    if (!field) return;
    field.addEventListener("focus", () => {
      if (field.value === "0") field.value = "";
    });
    field.addEventListener("input", () => {
      normalizeMeasureField(field);
      renderPreview();
    });
    field.addEventListener("blur", () => {
      normalizeMeasureField(field, true);
      renderPreview();
    });
  });
}

export function selectedFeatures() {
  const checked = Array.from(
    document.querySelectorAll<HTMLInputElement>("#featureChecks input:checked")
  ).map((item) => item.value);
  return Array.from(new Set(checked));
}

function hasFeature(name: string) {
  const expected = name.toLowerCase();
  return selectedFeatures().some((feature) => feature.toLowerCase() === expected);
}

export function updateSolarField() {
  const solarField = byId<HTMLElement>("solarField");
  const solarKwh = byId<HTMLInputElement>("propertySolarKwh");
  if (!solarField || !solarKwh) return;
  const visible = hasFeature("Painel solar");
  solarField.classList.toggle("solar-collapsed", !visible);
  if (!visible) solarKwh.value = "";
}

export function renderFeatureChecks(selected: string[] = []) {
  const target = byId<HTMLElement>("featureChecks");
  if (!target) return;
  const all = Array.from(new Set([...state.featureOptions, ...selected]));
  target.innerHTML =
    all
      .map(
        (feature) => `
    <label class="feature-check">
      <input type="checkbox" value="${escapeHtml(feature)}" ${selected.includes(feature) ? "checked" : ""} />
      <span class="checkbox-box">
        <svg class="checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </span>
      <span>${escapeHtml(feature)}</span>
    </label>
  `
      )
      .join("") +
    `
    <button class="feature-add-tile" type="button" data-feature-modal-open>
      <span class="add-icon">+</span>
      <span>Adicionar característica</span>
    </button>
  `;
  updateSolarField();
}

export function renderFeatureModal() {
  const list = byId<HTMLElement>("featureModalList");
  if (!list) return;
  list.innerHTML = state.featureOptions
    .map(
      (feature, index) => `
    <div class="feature-modal-item">
      <span>${escapeHtml(feature)}</span>
      <button type="button" data-feature-remove="${index}" aria-label="Remover ${escapeHtml(feature)}">&times;</button>
    </div>
  `
    )
    .join("");
}

export function openFeatureModal() {
  renderFeatureModal();
  byId("featureModal")?.classList.remove("is-hidden");
  byId<HTMLInputElement>("featureModalInput")?.focus({ preventScroll: true });
}

export function closeFeatureModal() {
  byId("featureModal")?.classList.add("is-hidden");
}

function currentFormProperty() {
  const city = input("propertyCity").value.trim() || "Cuiabá";
  const state2 = input("propertyState").value.trim().toUpperCase() || "MT";
  const street = input("propertyStreet").value.trim();
  const number = input("propertyNumber").value.trim();
  const neighborhood = input("propertyNeighborhood").value.trim();
  const streetLine = [street, number].filter(Boolean).join(", ");
  const location = [streetLine, neighborhood, city].filter(Boolean).join(" - ");
  return {
    title: input("propertyTitle").value.trim(),
    type: propertyTypeValue(),
    price: input("propertyPrice").value.trim(),
    street,
    number,
    neighborhood,
    city,
    state: state2,
    location: location ? `${location} — ${state2}` : "",
    beds: Number(input("propertyBeds").value || 0),
    suites: Number(input("propertySuites").value || 0),
    baths: Number(input("propertyBaths").value || 0),
    parking: Number(input("propertyParking").value || 0),
    area: Number(input("propertyArea").value || 0),
    features: selectedFeatures(),
    photos: state.photoDrafts
  };
}

function roomsText(property: ReturnType<typeof currentFormProperty>) {
  const beds = property.beds || 0;
  const suites = property.suites || 0;
  return `${beds} Quartos${suites ? ` (${suites} ${suites === 1 ? "Suíte" : "Suítes"})` : ""}`;
}

export function formatPriceField() {
  const field = input("propertyPrice");
  const value = field.value;
  const selectionStart = field.selectionStart ?? value.length;
  const digitsBeforeCursor = value.slice(0, selectionStart).replace(/\D/g, "").length;
  const clean = value.replace(/\D/g, "");
  const isRent = propertyTypeValue() === "Aluguel";

  if (!clean) {
    field.value = isRent ? "R$  / mês" : "R$ ";
    field.setSelectionRange(3, 3);
    return;
  }

  const formattedNumber = Number(clean).toLocaleString("pt-BR");
  const formatted = `R$ ${formattedNumber}${isRent ? " / mês" : ""}`;
  field.value = formatted;

  let newCursorPos = 3;
  let digitsSeen = 0;
  const suffixStart = isRent ? formatted.length - " / mês".length : formatted.length;
  for (let index = 3; index < suffixStart; index += 1) {
    if (digitsSeen === digitsBeforeCursor) break;
    if (/\d/.test(formatted[index])) digitsSeen += 1;
    newCursorPos += 1;
  }
  field.setSelectionRange(newCursorPos, newCursorPos);
}

export function renderPreview() {
  const preview = byId<HTMLElement>("propertyPreview");
  if (!preview) return;
  const property = currentFormProperty();
  const previewPhoto = property.photos[0]?.card_url || property.photos[0]?.url || "";
  const typeClass = property.type === "Venda" ? "sale" : "";
  preview.innerHTML = `
    <div class="preview-image">${previewPhoto ? `<img src="${escapeHtml(previewPhoto)}" alt="">` : ""}</div>
    <div class="preview-body">
      <span class="tag ${typeClass}">${escapeHtml(property.type)}</span>
      <h4>${escapeHtml(property.title || "Título do imóvel")}</h4>
      <p>${escapeHtml(property.location || "Localização")}</p>
      <strong>${escapeHtml(property.price || "Valor")}</strong>
      <div class="preview-specs">
        <span>${roomsText(property)}</span>
        <span>${property.baths} banh.</span>
        <span>${property.parking} vagas na garagem</span>
        <span>${property.area} m²</span>
      </div>
    </div>
  `;
  updateSolarField();
}

export function setDealType(value: string) {
  input("propertyType").value = value;
  document.querySelectorAll<HTMLButtonElement>(".type-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.typeValue === value);
  });
  formatPriceField();
  renderPreview();
}

export function hydrateMapPreview() {
  const frame = byId<HTMLIFrameElement>("adminMapFrame");
  if (!frame) return;
  const query =
    [
      input("propertyStreet").value,
      input("propertyNumber").value,
      input("propertyNeighborhood").value,
      input("propertyCity").value,
      input("propertyState").value
    ]
      .filter(Boolean)
      .join(" ") || "Cuiabá MT";
  frame.src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function resetForm() {
  byId<HTMLFormElement>("propertyForm")?.reset();
  input("propertyId").value = "";
  input("propertyState").value = "MT";
  input("propertyCity").value = "Cuiabá";
  input("propertyBeds").value = "0";
  input("propertySuites").value = "0";
  input("propertyBaths").value = "0";
  input("propertyParking").value = "0";
  input("propertyArea").value = "0";
  setDealType("Venda");
  state.photoDrafts.forEach((photo) => {
    if (photo.file) URL.revokeObjectURL(photo.url);
  });
  state.photoDrafts = [];
  renderFeatureChecks([]);
  renderPhotoList();
  renderPreview();
  hydrateMapPreview();
  const title = byId<HTMLElement>("formTitle");
  if (title) title.textContent = "Adicionar imóvel";
  setStatus(byId("formError"), "");
}

export function editProperty(id: string) {
  const property = state.properties.find((item) => item.id === id);
  if (!property) return;
  const legacy = toLegacyProperty(property);
  input("propertyId").value = property.id;
  input("propertyTitle").value = property.title;
  setDealType(legacy.type);
  input("propertyPrice").value = legacy.price;
  formatPriceField();
  input("propertyState").value = property.state || "MT";
  input("propertyCity").value = property.city || "Cuiabá";
  input("propertyNeighborhood").value = property.neighborhood || "";
  input("propertyStreet").value = property.street || "";
  input("propertyNumber").value = property.number || "";
  input("propertyPostalCode").value = property.postal_code || "";
  input("propertyBeds").value = String(property.bedrooms || 0);
  input("propertySuites").value = String(property.suites || 0);
  input("propertyBaths").value = String(property.bathrooms || 0);
  input("propertyParking").value = String(property.parking_spaces || 0);
  input("propertyArea").value = String(property.area_m2 || 0);
  input("propertySolarKwh").value = property.solar_kwh_month
    ? String(property.solar_kwh_month)
    : "";
  textarea("propertyDescription").value = property.description || "";
  input("propertyFeatured").checked = property.is_featured;
  renderFeatureChecks(property.features || []);
  state.photoDrafts = (property.photos || []).map((photo, index) => ({
    id: photo.id,
    storage_path: photo.storage_path,
    thumb_path: photo.thumb_path,
    card_path: photo.card_path,
    full_path: photo.full_path,
    url: photo.url || "",
    thumb_url: photo.thumb_url,
    card_url: photo.card_url,
    full_url: photo.full_url,
    alt: photo.alt,
    position: index
  }));
  renderPhotoList();
  renderPreview();
  hydrateMapPreview();
  const title = byId<HTMLElement>("formTitle");
  if (title) title.textContent = "Editar imóvel";
  setActiveTab("editor");
}

function currentPayload(): PropertyPayload {
  const existingId = input("propertyId").value;
  const existingProperty = existingId ? state.properties.find((p) => p.id === existingId) : null;
  const sortOrder =
    existingProperty && typeof existingProperty.sort_order === "number"
      ? existingProperty.sort_order
      : state.properties.length;

  return {
    title: input("propertyTitle").value.trim(),
    deal_type: legacyToDealType(propertyTypeValue()),
    price_cents: parseCurrencyToCents(input("propertyPrice").value),
    street: input("propertyStreet").value.trim() || null,
    number: input("propertyNumber").value.trim() || null,
    neighborhood: input("propertyNeighborhood").value.trim(),
    city: input("propertyCity").value.trim() || "Cuiabá",
    state: input("propertyState").value.trim().toUpperCase() || "MT",
    postal_code: input("propertyPostalCode").value.trim() || null,
    bedrooms: Number(input("propertyBeds").value || 0),
    suites: Number(input("propertySuites").value || 0),
    bathrooms: Number(input("propertyBaths").value || 0),
    parking_spaces: Number(input("propertyParking").value || 0),
    area_m2: Number(input("propertyArea").value || 0) || null,
    description: textarea("propertyDescription").value.trim() || null,
    features: selectedFeatures(),
    solar_kwh_month: hasFeature("Painel solar")
      ? Number(input("propertySolarKwh").value || 0) || null
      : null,
    is_featured: input("propertyFeatured").checked,
    sort_order: sortOrder
  };
}

function validateRequiredPropertyFields(payload: PropertyPayload) {
  const hasRequiredText =
    Boolean(payload.title) &&
    Boolean(payload.deal_type) &&
    Boolean(payload.neighborhood) &&
    Boolean(payload.city) &&
    /^[A-Z]{2}$/.test(payload.state);
  const hasValidPrice = typeof payload.price_cents === "number" && payload.price_cents > 0;
  const hasPhoto = state.photoDrafts.some((photo) =>
    Boolean(photo.file || photo.storage_path || photo.id)
  );

  if (!hasRequiredText || !hasValidPrice || !hasPhoto) {
    return "Preencha título, preço, bairro, cidade, UF e adicione pelo menos uma foto.";
  }

  if (payload.suites > payload.bedrooms) {
    return "O número de suítes não pode ser maior que o número de quartos.";
  }

  if (state.photoDrafts.length > MAX_PROPERTY_PHOTOS) {
    return `Limite de ${MAX_PROPERTY_PHOTOS} fotos por imovel.`;
  }

  return "";
}

export async function saveProperty(event: SubmitEvent) {
  event.preventDefault();
  if (!state.isAdmin) return;
  const payload = currentPayload();
  const validationError = validateRequiredPropertyFields(payload);
  if (validationError) {
    setStatus(byId("formError"), validationError, true);
    return;
  }
  setStatus(byId("formError"), "");
  setPropertySaveLoading(true);
  try {
    const existingId = input("propertyId").value;
    const response = existingId
      ? await adminJson<{ property: { id: string } }>(
          `/api/admin/properties/${encodeURIComponent(existingId)}`,
          "PATCH",
          payload
        )
      : await adminJson<{ property: { id: string } }>("/api/admin/properties", "POST", payload);
    await uploadAndSyncPhotos(response.property.id);
    await loadProperties();
    resetForm();
    setActiveTab("properties");
    showToast("Imovel salvo.", "success");
  } catch (error) {
    console.error(error);
    setStatus(byId("formError"), "Falha ao salvar. Verifique permissoes e conexao.", true);
  } finally {
    setPropertySaveLoading(false);
  }
}

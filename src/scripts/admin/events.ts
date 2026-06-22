import { AUTH_CAPTCHA_SITE_KEY } from "@/lib/env";
import { byId, setStatus } from "../dom";
import { adminApi, adminJson, AdminApiError } from "./api";
import { initTabHistory, input, setActiveTab, showToast } from "./ui";
import { MAX_PROPERTY_PHOTOS, state } from "./state";
import {
  clearLoginGuardState,
  formatLockDuration,
  initPasswordCaptcha,
  loginLockRemainingMs,
  registerLoginFailure,
  renderLoginGuardState,
  resetCaptcha,
  setLoginLoading
} from "./auth";
import { loadUsageIndicators } from "./usage";
import {
  bindMeasureNumberFields,
  closeFeatureModal,
  editProperty,
  formatPriceField,
  hydrateMapPreview,
  openFeatureModal,
  renderFeatureChecks,
  renderFeatureModal,
  renderPreview,
  resetForm,
  saveProperty,
  selectedFeatures,
  setDealType,
  updateSolarField
} from "./propertyForm";
import { saveContact } from "./contact";
import { renderPasswordRequirements, savePassword, updatePasswordRequirements } from "./password";
import { bindPasswordToggles } from "./passwordToggle";
import { deleteProperty, loadProperties, setFeatured } from "./propertyList";
import { removePhoto, renderPhotoList, reorderPhotos } from "./photos";

export function bindEvents() {
  byId<HTMLFormElement>("loginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const remaining = loginLockRemainingMs();
    if (remaining > 0) {
      renderLoginGuardState();
      return;
    }

    if (AUTH_CAPTCHA_SITE_KEY && !state.captchaToken) {
      setStatus(byId("loginError"), "Conclua a verificacao anti-robo antes de entrar.", true);
      return;
    }

    setLoginLoading(true);
    setStatus(byId("loginError"), "");
    try {
      await adminJson<{ isAdmin: boolean }>("/api/admin/login", "POST", {
        email: input("adminEmail").value.trim(),
        password: input("adminPassword").value,
        captchaToken: AUTH_CAPTCHA_SITE_KEY ? state.captchaToken : ""
      });
      clearLoginGuardState();
      location.reload();
    } catch (error) {
      registerLoginFailure();
      resetCaptcha();
      const lockedAfterFailure = loginLockRemainingMs();
      if (lockedAfterFailure > 0) {
        setLoginLoading(false);
        setStatus(
          byId("loginError"),
          `Muitas tentativas de login. Tente novamente em ${formatLockDuration(lockedAfterFailure)}.`,
          true
        );
        return;
      }
      setLoginLoading(false);
      const apiError = error as AdminApiError;
      const message =
        apiError.status === 429
          ? "Muitas tentativas no servidor. Aguarde antes de tentar novamente."
          : apiError.status === 403
            ? "Usuario autenticado, mas sem permissao de admin."
            : apiError.status === 400
              ? "Informe e-mail e senha."
              : "E-mail ou senha incorretos.";
      setStatus(byId("loginError"), message, true);
      return;
    }
  });

  byId("logoutBtn")?.addEventListener("click", async () => {
    await adminApi("/api/admin/logout", { method: "POST" }).catch(() => null);
    location.reload();
  });

  initTabHistory((tabName) => {
    if (tabName === "settings") {
      void loadUsageIndicators();
      void initPasswordCaptcha();
    }
  });

  document.querySelectorAll<HTMLButtonElement>(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const tabName = tab.dataset.tab || "properties";
      setActiveTab(tabName);
      if (tabName === "settings") {
        void loadUsageIndicators();
        void initPasswordCaptcha();
      }
      closeSidebar();
    });
  });
  byId("newPropertyBtn")?.addEventListener("click", () => {
    resetForm();
    setActiveTab("editor");
  });
  byId("editorBackBtn")?.addEventListener("click", () => {
    setActiveTab("properties");
  });
  byId("cancelEditBtn")?.addEventListener("click", () => {
    resetForm();
    setActiveTab("properties");
  });
  byId<HTMLFormElement>("propertyForm")?.addEventListener("submit", saveProperty);
  byId<HTMLFormElement>("contactFormAdmin")?.addEventListener("submit", saveContact);
  byId<HTMLFormElement>("passwordFormAdmin")?.addEventListener("submit", savePassword);
  renderPasswordRequirements();
  byId("newPassword")?.addEventListener("input", updatePasswordRequirements);
  bindPasswordToggles();
  byId("refreshUsageBtn")?.addEventListener("click", () => void loadUsageIndicators());
  bindMeasureNumberFields();

  document.querySelectorAll<HTMLButtonElement>(".type-option").forEach((button) => {
    button.addEventListener("click", () => setDealType(button.dataset.typeValue || "Venda"));
  });

  byId("featureModal")?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-feature-modal-close]")) closeFeatureModal();
    const remove = target.closest<HTMLButtonElement>("[data-feature-remove]");
    if (remove) {
      const removeIndex = Number(remove.dataset.featureRemove || -1);
      const removedFeature = state.featureOptions[removeIndex];
      const selected = selectedFeatures().filter((feature) => feature !== removedFeature);
      state.featureOptions = state.featureOptions.filter((_, index) => index !== removeIndex);
      renderFeatureChecks(selected);
      renderFeatureModal();
      renderPreview();
    }
  });
  byId("featureModalAddBtn")?.addEventListener("click", () => {
    const field = byId<HTMLInputElement>("featureModalInput");
    const value = field?.value.trim();
    if (!value) return;
    const selected = selectedFeatures();
    state.featureOptions = Array.from(new Set([...state.featureOptions, value]));
    if (!selected.some((feature) => feature.toLowerCase() === value.toLowerCase()))
      selected.push(value);
    if (field) field.value = "";
    renderFeatureChecks(selected);
    renderFeatureModal();
    renderPreview();
  });
  byId("featureModalInput")?.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") {
      event.preventDefault();
      byId("featureModalAddBtn")?.click();
    }
  });
  byId("propertyForm")?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("[data-feature-modal-open]")) openFeatureModal();
  });

  byId("propertyList")?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-admin-retry-properties]")) {
      void loadProperties();
      return;
    }
    if (target.closest("[data-page-prev]")) {
      if (state.currentPage > 1) void loadProperties(state.currentPage - 1);
      return;
    }
    if (target.closest("[data-page-next]")) {
      if (state.currentPage < state.totalPages) void loadProperties(state.currentPage + 1);
      return;
    }
    const button = target.closest<HTMLButtonElement>("[data-action]");
    if (!button) return;
    const id = button.dataset.id || "";
    if (button.dataset.action === "edit") editProperty(id);
    if (button.dataset.action === "delete") void deleteProperty(id);
    if (button.dataset.action === "featured") void setFeatured(id);
  });

  byId<HTMLInputElement>("photoInput")?.addEventListener("change", (event) => {
    const files = Array.from((event.target as HTMLInputElement).files || []);
    let skipped = 0;
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (state.photoDrafts.length >= MAX_PROPERTY_PHOTOS) {
        skipped += 1;
        return;
      }
      state.photoDrafts.push({
        url: URL.createObjectURL(file),
        alt: file.name,
        file,
        position: state.photoDrafts.length
      });
    });
    input("photoInput").value = "";
    renderPhotoList();
    renderPreview();
    if (skipped > 0) {
      showToast(`Limite de ${MAX_PROPERTY_PHOTOS} fotos por imovel.`, "danger");
    }
  });

  byId("photoList")?.addEventListener("click", (event) => {
    const remove = (event.target as HTMLElement).closest<HTMLButtonElement>(".photo-remove");
    if (remove) void removePhoto(Number(remove.dataset.index || 0));
  });
  byId("photoList")?.addEventListener("dragstart", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".photo-item");
    if (!item) return;
    state.draggedPhotoIndex = Number(item.dataset.index || 0);
    item.classList.add("dragging");
  });
  byId("photoList")?.addEventListener("dragover", (event) => event.preventDefault());
  byId("photoList")?.addEventListener("dragenter", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".photo-item");
    if (item) item.classList.add("drag-over");
  });
  byId("photoList")?.addEventListener("dragleave", (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>(".photo-item");
    if (item) item.classList.remove("drag-over");
  });
  byId("photoList")?.addEventListener("drop", (event) => {
    event.preventDefault();
    const item = (event.target as HTMLElement).closest<HTMLElement>(".photo-item");
    if (state.draggedPhotoIndex === null || !item) return;
    const targetIndex = Number(item.dataset.index || 0);
    item.classList.remove("drag-over");
    reorderPhotos(state.draggedPhotoIndex, targetIndex);
    state.draggedPhotoIndex = null;
  });
  byId("photoList")?.addEventListener("dragend", () => {
    state.draggedPhotoIndex = null;
    document
      .querySelectorAll(".photo-item.dragging, .photo-item.drag-over")
      .forEach((item) => item.classList.remove("dragging", "drag-over"));
  });

  byId("featureChecks")?.addEventListener("change", () => {
    updateSolarField();
    renderPreview();
  });
  byId("propertyPrice")?.addEventListener("input", () => {
    formatPriceField();
    renderPreview();
  });
  [
    "propertyTitle",
    "propertyType",
    "propertyCity",
    "propertyNeighborhood",
    "propertyStreet",
    "propertyNumber",
    "propertyPostalCode",
    "propertyDescription",
    "propertySolarKwh"
  ].forEach((id) => {
    byId(id)?.addEventListener("input", () => {
      renderPreview();
      hydrateMapPreview();
    });
  });

  byId("menuToggleBtn")?.addEventListener("click", () => {
    byId("adminSidebar")?.classList.add("active");
    byId("sidebarBackdrop")?.classList.add("active");
    document.body.classList.add("sidebar-open");
  });
  const closeSidebar = () => {
    byId("adminSidebar")?.classList.remove("active");
    byId("sidebarBackdrop")?.classList.remove("active");
    document.body.classList.remove("sidebar-open");
  };
  byId("menuCloseBtn")?.addEventListener("click", closeSidebar);
  byId("sidebarBackdrop")?.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });
}

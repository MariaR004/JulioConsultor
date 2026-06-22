import {
  clearLegacySupabaseBrowserAuth,
  initCaptcha,
  renderLoginGuardState,
  verifyAdmin
} from "./auth";
import { showApp, showLogin } from "./ui";
import { renderFeatureChecks, resetForm } from "./propertyForm";
import { bindEvents } from "./events";
import { loadProperties } from "./propertyList";
import { loadContact } from "./contact";
import { loadUsageIndicators } from "./usage";
import { state } from "./state";

async function init() {
  clearLegacySupabaseBrowserAuth();
  renderFeatureChecks([]);
  bindEvents();
  renderLoginGuardState();
  void initCaptcha();
  resetForm();
  state.isAdmin = await verifyAdmin();
  if (!state.isAdmin) {
    showLogin();
    return;
  }
  showApp();
  await Promise.all([loadProperties(), loadContact(), loadUsageIndicators()]);
}

void init();

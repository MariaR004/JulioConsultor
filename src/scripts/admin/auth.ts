import { AUTH_CAPTCHA_PROVIDER, AUTH_CAPTCHA_SITE_KEY } from "@/lib/env";
import { byId, setStatus } from "../dom";
import { adminApi } from "./api";
import { LOGIN_GUARD_STORAGE_KEY, LOGIN_LOCK_MS, LOGIN_MAX_FAILURES, state } from "./state";

type LoginGuardState = {
  failures: number;
  lockedUntil: number;
  updatedAt: number;
};

type CaptchaProvider = "turnstile" | "hcaptcha";

type CaptchaApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: CaptchaApi;
    hcaptcha?: CaptchaApi;
  }
}

export function clearLegacySupabaseBrowserAuth() {
  const names = document.cookie
    .split(";")
    .map((item) => item.trim().split("=")[0])
    .filter(
      (name) => name === "sb-access-token" || name === "sb-refresh-token" || name.startsWith("sb-")
    );

  for (const name of names) {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict`;
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Strict; Secure`;
  }

  try {
    Object.keys(localStorage)
      .filter((name) => name.startsWith("sb-") || name.includes("supabase"))
      .forEach((name) => localStorage.removeItem(name));
    Object.keys(sessionStorage)
      .filter((name) => name.startsWith("sb-") || name.includes("supabase"))
      .forEach((name) => sessionStorage.removeItem(name));
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}

export async function verifyAdmin() {
  try {
    const session = await adminApi<{ isAdmin: boolean }>("/api/admin/session");
    return Boolean(session.isAdmin);
  } catch {
    return false;
  }
}

function loginGuardState(): LoginGuardState {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(LOGIN_GUARD_STORAGE_KEY) || "{}"
    ) as Partial<LoginGuardState>;
    return {
      failures: Number(parsed.failures || 0),
      lockedUntil: Number(parsed.lockedUntil || 0),
      updatedAt: Number(parsed.updatedAt || 0)
    };
  } catch {
    return { failures: 0, lockedUntil: 0, updatedAt: 0 };
  }
}

function saveLoginGuardState(guardState: LoginGuardState) {
  localStorage.setItem(LOGIN_GUARD_STORAGE_KEY, JSON.stringify(guardState));
}

export function clearLoginGuardState() {
  localStorage.removeItem(LOGIN_GUARD_STORAGE_KEY);
}

export function loginLockRemainingMs() {
  return Math.max(0, loginGuardState().lockedUntil - Date.now());
}

export function formatLockDuration(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}min ${seconds}s` : `${seconds}s`;
}

export function renderLoginGuardState() {
  const remaining = loginLockRemainingMs();
  const submit = byId<HTMLButtonElement>("loginSubmitBtn");
  if (submit) submit.disabled = remaining > 0;
  if (remaining > 0) {
    setStatus(
      byId("loginError"),
      `Muitas tentativas de login. Tente novamente em ${formatLockDuration(remaining)}.`,
      true
    );
    window.setTimeout(renderLoginGuardState, Math.min(1000, remaining));
  }
}

export function setLoginLoading(isLoading: boolean) {
  const submit = byId<HTMLButtonElement>("loginSubmitBtn");
  if (!submit) return;

  submit.disabled = isLoading || loginLockRemainingMs() > 0;
  submit.classList.toggle("is-loading", isLoading);
  submit.setAttribute("aria-busy", String(isLoading));
  submit.textContent = isLoading ? "Validando..." : "Entrar";
}

export function registerLoginFailure() {
  const now = Date.now();
  const current = loginGuardState();
  const nextState: LoginGuardState = {
    failures: current.lockedUntil > now ? current.failures : current.failures + 1,
    lockedUntil: current.lockedUntil > now ? current.lockedUntil : 0,
    updatedAt: now
  };

  if (nextState.failures >= LOGIN_MAX_FAILURES) {
    nextState.lockedUntil = now + LOGIN_LOCK_MS;
  }

  saveLoginGuardState(nextState);
  renderLoginGuardState();
}

function captchaProvider(): CaptchaProvider {
  return AUTH_CAPTCHA_PROVIDER === "hcaptcha" ? "hcaptcha" : "turnstile";
}

function captchaApi() {
  return captchaProvider() === "hcaptcha" ? window.hcaptcha : window.turnstile;
}

function captchaScriptUrl() {
  return captchaProvider() === "hcaptcha"
    ? "https://js.hcaptcha.com/1/api.js?render=explicit"
    : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
}

function loadExternalScript(id: string, src: string) {
  if (document.getElementById(id)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });
}

async function renderCaptchaWidget(options: {
  containerId: string;
  onToken: (token: string) => void;
  onClear: () => void;
  onError: (message: string) => void;
}): Promise<string | null> {
  const container = byId<HTMLElement>(options.containerId);
  if (!container || !AUTH_CAPTCHA_SITE_KEY) return null;
  // Renderiza apenas uma vez por container; resets reaproveitam o mesmo widget.
  if (container.dataset.captchaRendered === "true") return null;

  try {
    await loadExternalScript(`admin-${captchaProvider()}-captcha`, captchaScriptUrl());
    const api = captchaApi();
    if (!api) throw new Error("API de CAPTCHA indisponivel.");
    const widgetId = api.render(container, {
      sitekey: AUTH_CAPTCHA_SITE_KEY,
      theme: "light",
      callback: options.onToken,
      "expired-callback": options.onClear,
      "error-callback": options.onClear
    });
    container.dataset.captchaRendered = "true";
    return widgetId;
  } catch (error) {
    console.error(error);
    options.onError("Nao foi possivel carregar a verificacao anti-robo.");
    return null;
  }
}

export async function initCaptcha() {
  const widgetId = await renderCaptchaWidget({
    containerId: "adminCaptcha",
    onToken: (token) => {
      state.captchaToken = token;
      setStatus(byId("loginError"), "");
    },
    onClear: () => {
      state.captchaToken = "";
    },
    onError: (message) => setStatus(byId("loginError"), message, true)
  });
  if (widgetId) state.captchaWidgetId = widgetId;
}

export function resetCaptcha() {
  state.captchaToken = "";
  captchaApi()?.reset(state.captchaWidgetId || undefined);
}

export async function initPasswordCaptcha() {
  const widgetId = await renderCaptchaWidget({
    containerId: "passwordCaptcha",
    onToken: (token) => {
      state.passwordCaptchaToken = token;
      setStatus(byId("passwordStatus"), "");
    },
    onClear: () => {
      state.passwordCaptchaToken = "";
    },
    onError: (message) => setStatus(byId("passwordStatus"), message, true)
  });
  if (widgetId) state.passwordCaptchaWidgetId = widgetId;
}

export function resetPasswordCaptcha() {
  state.passwordCaptchaToken = "";
  if (state.passwordCaptchaWidgetId) captchaApi()?.reset(state.passwordCaptchaWidgetId);
}

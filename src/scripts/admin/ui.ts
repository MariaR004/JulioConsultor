import { byId } from "../dom";

export function input(id: string) {
  const el = byId<HTMLInputElement>(id);
  if (!el) return document.createElement("input");
  return el;
}

export function textarea(id: string) {
  const el = byId<HTMLTextAreaElement>(id);
  if (!el) return document.createElement("textarea");
  return el;
}

export function showToast(message: string, type: "success" | "danger" = "success") {
  const toast = byId<HTMLElement>("adminToast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `admin-toast ${type} show`;
  setTimeout(() => toast.classList.remove("show"), 2400);
}

export function confirmAction(options: { title: string; message: string; confirmLabel: string }) {
  const modal = byId<HTMLElement>("confirmModal");
  const title = byId<HTMLElement>("confirmModalTitle");
  const text = byId<HTMLElement>("confirmModalText");
  const confirmButton = byId<HTMLButtonElement>("confirmModalConfirm");
  if (!modal || !title || !text || !confirmButton) return Promise.resolve(false);

  title.textContent = options.title;
  text.textContent = options.message;
  confirmButton.textContent = options.confirmLabel;
  modal.classList.remove("is-hidden");
  confirmButton.focus({ preventScroll: true });

  return new Promise<boolean>((resolve) => {
    const finish = (confirmed: boolean) => {
      modal.classList.add("is-hidden");
      modal.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeydown);
      resolve(confirmed);
    };

    const onClick = (event: MouseEvent) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>("[data-confirm-action]")
        ?.dataset.confirmAction;
      if (action === "confirm") finish(true);
      if (action === "cancel") finish(false);
    };

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish(false);
    };

    modal.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeydown);
  });
}

export function showLogin() {
  byId("loginScreen")?.classList.remove("is-hidden");
  byId("adminApp")?.classList.add("is-hidden");
}

export function showApp() {
  byId("loginScreen")?.classList.add("is-hidden");
  const app = byId("adminApp");
  app?.classList.remove("is-hidden");
  requestAnimationFrame(() => app?.classList.add("entered"));
}

export function setActiveTab(name: string, skipHistory = false) {
  document.querySelectorAll<HTMLButtonElement>(".admin-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === name);
  });
  document.querySelectorAll<HTMLElement>(".admin-panel").forEach((panel) => {
    const active = panel.id === `tab-${name}`;
    panel.classList.toggle("active", active);
    if (active) {
      panel.classList.remove("animate-in");
      void panel.offsetHeight;
      panel.classList.add("animate-in");
    }
  });
  if (!skipHistory) syncTabHistory(name);
}

/* Integração com o histórico do navegador: abrir editor/configurações empilha
   um estado, então o botão voltar do celular retorna à lista de imóveis em vez
   de sair do admin. */
let tabHistoryReady = false;

function currentHistoryTab(): string {
  const state = history.state as { adminTab?: string } | null;
  return state?.adminTab || "properties";
}

function syncTabHistory(name: string) {
  if (!tabHistoryReady || typeof history === "undefined") return;
  const current = currentHistoryTab();
  if (name === current) return;
  if (name === "properties") {
    // Volta ao estado base sem empilhar entradas extras.
    history.back();
  } else if (current !== "properties") {
    history.replaceState({ adminTab: name }, "");
  } else {
    history.pushState({ adminTab: name }, "");
  }
}

export function initTabHistory(onNavigate?: (name: string) => void) {
  if (tabHistoryReady || typeof history === "undefined") return;
  tabHistoryReady = true;
  history.replaceState({ adminTab: "properties" }, "");
  window.addEventListener("popstate", (event) => {
    const name = (event.state as { adminTab?: string } | null)?.adminTab || "properties";
    setActiveTab(name, true);
    onNavigate?.(name);
  });
}

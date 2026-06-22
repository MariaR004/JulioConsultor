import { AUTH_CAPTCHA_SITE_KEY } from "@/lib/env";
import { PASSWORD_RULES, evaluatePassword, passwordMeetsPolicy } from "@/lib/passwordPolicy";
import { byId, setStatus } from "../dom";
import { adminJson, AdminApiError } from "./api";
import { resetPasswordCaptcha } from "./auth";
import { input } from "./ui";
import { state } from "./state";

function setPasswordSaveLoading(isLoading: boolean) {
  const submit = byId<HTMLButtonElement>("passwordSubmitBtn");
  if (!submit) return;
  submit.disabled = isLoading;
  submit.classList.toggle("is-loading", isLoading);
  submit.setAttribute("aria-busy", String(isLoading));
  submit.textContent = isLoading ? "Alterando..." : "Alterar senha";
}

// Monta a lista de requisitos uma única vez a partir da política compartilhada.
export function renderPasswordRequirements() {
  const list = byId<HTMLUListElement>("passwordRequirements");
  if (!list || list.childElementCount > 0) return;
  for (const rule of PASSWORD_RULES) {
    const item = document.createElement("li");
    item.className = "password-req";
    item.dataset.rule = rule.id;
    const icon = document.createElement("span");
    icon.className = "password-req-icon";
    icon.setAttribute("aria-hidden", "true");
    item.append(icon, document.createTextNode(rule.label));
    list.append(item);
  }
}

// Atualiza os marcadores (✓) conforme o usuário digita a nova senha.
export function updatePasswordRequirements() {
  const list = byId<HTMLUListElement>("passwordRequirements");
  if (!list) return;
  const results = evaluatePassword(input("newPassword").value);
  list.querySelectorAll<HTMLLIElement>("li[data-rule]").forEach((item) => {
    item.classList.toggle("met", Boolean(results[item.dataset.rule || ""]));
  });
}

export async function savePassword(event: SubmitEvent) {
  event.preventDefault();
  if (!state.isAdmin) return;

  const currentPassword = input("currentPassword").value;
  const newPassword = input("newPassword").value;
  const confirmPassword = input("confirmPassword").value;
  const status = byId("passwordStatus");

  if (!currentPassword || !newPassword || !confirmPassword) {
    setStatus(status, "Preencha todos os campos.", true);
    return;
  }
  if (!passwordMeetsPolicy(newPassword)) {
    setStatus(status, "A nova senha não atende a todos os requisitos abaixo.", true);
    updatePasswordRequirements();
    return;
  }
  if (newPassword !== confirmPassword) {
    setStatus(status, "A confirmação não confere com a nova senha.", true);
    return;
  }
  if (newPassword === currentPassword) {
    setStatus(status, "A nova senha deve ser diferente da atual.", true);
    return;
  }
  if (AUTH_CAPTCHA_SITE_KEY && !state.passwordCaptchaToken) {
    setStatus(status, "Conclua a verificação anti-robô antes de continuar.", true);
    return;
  }

  setPasswordSaveLoading(true);
  try {
    await adminJson<{ ok: boolean }>("/api/admin/password", "POST", {
      currentPassword,
      newPassword,
      captchaToken: AUTH_CAPTCHA_SITE_KEY ? state.passwordCaptchaToken : ""
    });
    setStatus(status, "Senha alterada com sucesso.", false);
    input("currentPassword").value = "";
    input("newPassword").value = "";
    input("confirmPassword").value = "";
  } catch (error) {
    const apiError = error as AdminApiError;
    setStatus(status, apiError.message || "Não foi possível alterar a senha.", true);
  } finally {
    // O token do captcha é de uso único; força um novo desafio para a próxima troca.
    resetPasswordCaptcha();
    setPasswordSaveLoading(false);
  }
}

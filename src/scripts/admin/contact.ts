import type { ContactSettings } from "@/types";
import { DEFAULT_CONTACT, cleanPhone } from "@/lib/format";
import { normalizeContact } from "@/lib/viewModel";
import { byId, setStatus, formatPhoneInput } from "../dom";
import { adminApi, adminJson } from "./api";
import { input, showToast } from "./ui";
import { state } from "./state";

function setContactSaveLoading(isLoading: boolean) {
  const submit = byId<HTMLButtonElement>("contactSubmitBtn");
  if (!submit) return;
  submit.disabled = isLoading;
  submit.classList.toggle("is-loading", isLoading);
  submit.setAttribute("aria-busy", String(isLoading));
  submit.textContent = isLoading ? "Salvando..." : "Salvar contato";
}

function initPhoneFormatting() {
  const whatsappInput = byId<HTMLInputElement>("contactWhatsappInput");
  const phoneInput = byId<HTMLInputElement>("contactPhoneInput");

  whatsappInput?.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement;
    el.value = formatPhoneInput(el.value);
  });

  phoneInput?.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement;
    el.value = formatPhoneInput(el.value);
  });
}

export async function loadContact() {
  if (!state.isAdmin) return;
  let contact = DEFAULT_CONTACT;
  try {
    const response = await adminApi<{ contact: ContactSettings }>("/api/admin/contact");
    contact = normalizeContact(response.contact);
  } catch {
    showToast("Nao foi possivel carregar o contato.", "danger");
  }
  input("contactWhatsappInput").value = formatPhoneInput(contact.whatsapp);
  input("contactPhoneInput").value = formatPhoneInput(contact.phone);
  input("contactEmailInput").value = contact.email;
  initPhoneFormatting();
}

export async function saveContact(event: SubmitEvent) {
  event.preventDefault();
  if (!state.isAdmin) return;
  const payload: ContactSettings = {
    whatsapp: cleanPhone(input("contactWhatsappInput").value),
    phone: cleanPhone(input("contactPhoneInput").value),
    email: input("contactEmailInput").value.trim()
  };
  setContactSaveLoading(true);
  try {
    await adminJson<{ contact: ContactSettings }>("/api/admin/contact", "PATCH", payload);
    setStatus(byId("contactStatus"), "Contato salvo.", false);
  } catch {
    setStatus(byId("contactStatus"), "Falha ao salvar contato.", true);
  } finally {
    setContactSaveLoading(false);
  }
}

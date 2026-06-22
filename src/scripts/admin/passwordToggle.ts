// Liga os botões de mostrar/ocultar senha (componente PasswordToggle.astro).
// Alterna o type do input entre "password" e "text" e atualiza o estado a11y.
export function bindPasswordToggles() {
  document.querySelectorAll<HTMLButtonElement>("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.closest(".password-input");
      const input = field?.querySelector<HTMLInputElement>("input");
      if (!input) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-pressed", String(reveal));
      button.setAttribute("aria-label", reveal ? "Ocultar senha" : "Mostrar senha");
    });
  });
}

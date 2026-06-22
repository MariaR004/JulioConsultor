export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

export function setStatus(el: HTMLElement | null, message: string, error = false) {
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", error);
}

export function formatPhoneInput(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");

  // Extract country code (55) if present
  let countryCode = "";
  let rest = digits;
  if (digits.startsWith("55")) {
    countryCode = "55";
    rest = digits.slice(2);
  } else if (digits.length > 11) {
    // If more than 11 digits and doesn't start with 55, still remove extras
    rest = digits.slice(0, 11);
  }

  // Now format the rest: 10 or 11 digits (with or without the leading 9)
  if (rest.length === 0) return countryCode ? `+${countryCode} ` : "";
  if (rest.length <= 2) {
    return countryCode ? `+${countryCode} (${rest}` : `(${rest}`;
  }
  if (rest.length <= 7) {
    const areaCode = rest.slice(0, 2);
    const firstPart = rest.slice(2);
    return countryCode
      ? `+${countryCode} (${areaCode}) ${firstPart}`
      : `(${areaCode}) ${firstPart}`;
  }

  // 8 or more digits: differentiate between 10 and 11 digit formats
  const areaCode = rest.slice(0, 2);
  if (rest.length === 10) {
    // 10 digits: (XX) XXXX-XXXX (format without 9)
    const firstPart = rest.slice(2, 6);
    const secondPart = rest.slice(6, 10);
    return countryCode
      ? `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
      : `(${areaCode}) ${firstPart}-${secondPart}`;
  }

  // 11 digits: (XX) XXXXX-XXXX (format with 9)
  const firstPart = rest.slice(2, 7);
  const secondPart = rest.slice(7, 11);
  return countryCode
    ? `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`
    : `(${areaCode}) ${firstPart}-${secondPart}`;
}

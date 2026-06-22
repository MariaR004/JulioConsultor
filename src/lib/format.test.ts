import { describe, expect, it } from "vitest";
import { cleanPhone, formatCurrency, formatPhone, slugify } from "@/lib/format";

describe("format helpers", () => {
  it("cleanPhone remove non-digits", () => {
    expect(cleanPhone("(65) 9605-2977")).toBe("6596052977");
  });

  it("formatPhone formats Brazilian phone numbers", () => {
    expect(formatPhone("6596052977")).toBe("(65) 9605-2977");
  });

  it("formatCurrency formats rent prices with monthly suffix", () => {
    expect(formatCurrency(150000, "rent").replace(/\s+/g, " ")).toBe("R$ 1.500 / mês");
  });
});

describe("slugify", () => {
  it("remove acentos e troca espaços por hífens", () => {
    expect(slugify("Casa térrea premium no Jardim das Américas")).toBe(
      "casa-terrea-premium-no-jardim-das-americas"
    );
  });

  it("colapsa pontuação e hífens repetidos", () => {
    expect(slugify("Apto 2/4 — Centro!!!")).toBe("apto-2-4-centro");
  });

  it("remove hífens nas pontas", () => {
    expect(slugify("  Cobertura à venda  ")).toBe("cobertura-a-venda");
  });

  it("retorna string vazia para entrada vazia ou nula", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
  });
});

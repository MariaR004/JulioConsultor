import { describe, expect, it } from "vitest";
import {
  MAX_PROPERTY_PHOTOS,
  requiredCaptchaError,
  validateImageFile,
  validatePasswordChangePayload,
  validatePropertyPayload,
  validatePropertyPhotoLimit
} from "@/lib/server/adminValidation";

describe("validatePropertyPayload", () => {
  it("rejects a payload without required title", () => {
    const result = validatePropertyPayload({
      neighborhood: "Centro",
      city: "Cuiabá",
      state: "MT",
      deal_type: "sale",
      price_cents: 1000
    });

    expect(result.error).toBe("title é obrigatório.");
  });

  it("rejects suites greater than bedrooms", () => {
    const result = validatePropertyPayload(
      {
        title: "Casa",
        neighborhood: "Centro",
        city: "Cuiabá",
        state: "MT",
        deal_type: "sale",
        price_cents: 1000,
        bedrooms: 2,
        suites: 3,
        bathrooms: 1,
        parking_spaces: 1
      },
      { partial: true }
    );

    expect(result.error).toContain("suítes");
  });
});

describe("validatePasswordChangePayload", () => {
  it("rejects a missing current password", () => {
    const result = validatePasswordChangePayload({ newPassword: "NovaSenha123!" });
    expect(result.error).toBe("Informe a senha atual.");
  });

  it("rejects a new password shorter than 8 characters", () => {
    const result = validatePasswordChangePayload({
      currentPassword: "Antiga123!",
      newPassword: "Aa1!"
    });
    expect(result.error).toContain("8 caracteres");
  });

  it("rejects a new password without an uppercase letter", () => {
    const result = validatePasswordChangePayload({
      currentPassword: "Antiga123!",
      newPassword: "novasenha123!"
    });
    expect(result.error).toContain("maiúscula");
  });

  it("rejects a new password without a symbol", () => {
    const result = validatePasswordChangePayload({
      currentPassword: "Antiga123!",
      newPassword: "NovaSenha123"
    });
    expect(result.error).toContain("símbolo");
  });

  it("rejects a new password equal to the current one", () => {
    const result = validatePasswordChangePayload({
      currentPassword: "MesmaSenha123!",
      newPassword: "MesmaSenha123!"
    });
    expect(result.error).toBe("A nova senha deve ser diferente da atual.");
  });

  it("accepts a valid payload and defaults captchaToken to empty", () => {
    const result = validatePasswordChangePayload({
      currentPassword: "Antiga123!",
      newPassword: "NovaSenha123!"
    });
    expect(result.error).toBeNull();
    expect(result.value).toEqual({
      currentPassword: "Antiga123!",
      newPassword: "NovaSenha123!",
      captchaToken: ""
    });
  });
});

describe("requiredCaptchaError", () => {
  it("rejects empty captcha when a site key is configured", () => {
    expect(requiredCaptchaError("site-key", "")).toContain("anti-robô");
  });

  it("does not require captcha when site key is absent", () => {
    expect(requiredCaptchaError("", "")).toBe("");
  });
});

describe("validatePropertyPhotoLimit", () => {
  it("allows upload below the limit and rejects the 13th photo", () => {
    expect(validatePropertyPhotoLimit(MAX_PROPERTY_PHOTOS - 1)).toBe("");
    expect(validatePropertyPhotoLimit(MAX_PROPERTY_PHOTOS)).toContain("12 fotos");
  });
});

describe("validateImageFile", () => {
  it("accepts JPEG, PNG and WebP files with matching magic bytes", async () => {
    const jpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", {
      type: "image/jpeg"
    });
    const png = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "photo.png",
      { type: "image/png" }
    );
    const webp = new File(
      [new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
      "photo.webp",
      { type: "image/webp" }
    );

    await expect(validateImageFile(jpeg, "jpeg")).resolves.toBe("");
    await expect(validateImageFile(png, "png")).resolves.toBe("");
    await expect(validateImageFile(webp, "webp")).resolves.toBe("");
  });

  it("rejects a file whose bytes do not match the declared MIME type", async () => {
    const fakeJpeg = new File([new TextEncoder().encode("not an image")], "photo.jpg", {
      type: "image/jpeg"
    });

    await expect(validateImageFile(fakeJpeg, "full")).resolves.toContain("conteúdo inválido");
  });

  it("rejects a valid image signature with the wrong MIME type", async () => {
    const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const mismatched = new File([webpBytes], "photo.png", { type: "image/png" });

    await expect(validateImageFile(mismatched, "card")).resolves.toContain("conteúdo inválido");
  });
});

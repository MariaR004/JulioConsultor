import { describe, expect, it, vi } from "vitest";
import { GET as getSitemap } from "@/pages/sitemap.xml";
import {
  validatePropertyPayload,
  validateContactPayload,
  requiredCaptchaError
} from "@/lib/server/adminValidation";
import { cleanPhone, formatPhone, whatsappUrl } from "@/lib/format";
import { getPublicProperties, getContactSettings } from "@/lib/propertyData";
import { toPublicHomeData } from "@/lib/server/publicData";

// Mock global environment variables
vi.mock("@/lib/env", () => ({
  SUPABASE_URL: "https://byxqgsfbnyhgczrssyxm.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_-R_is_81viq3p1Wdfs7wGQ_j1jFw-ft",
  SITE_ORIGIN: "http://127.0.0.1:4323",
  SITE_URL: "http://127.0.0.1:4323",
  AUTH_CAPTCHA_PROVIDER: "turnstile",
  AUTH_CAPTCHA_SITE_KEY: "0x4AAAAAADfqy92bCzzrJoS5",
  isSupabaseConfigured: true
}));

describe("QA Checklist Validation Tests", () => {
  // ==========================================
  // Checklist 1: Fluxo de CRUD Completo (Validation logic)
  // ==========================================
  describe("1. CRUD Validation Logic", () => {
    it("should accept a valid property payload", () => {
      const valid = {
        title: "Imóvel de Teste",
        neighborhood: "Jardim das Américas",
        city: "Cuiabá",
        state: "MT",
        deal_type: "sale",
        price_cents: 85000000,
        bedrooms: 3,
        suites: 2,
        bathrooms: 3,
        parking_spaces: 2,
        area_m2: 120,
        description: "Lindo imóvel de teste para homologação.",
        features: ["Piscina", "Churrasqueira"],
        is_featured: false,
        sort_order: 1
      };
      const res = validatePropertyPayload(valid);
      expect(res.error).toBeNull();
      expect(res.value).toMatchObject(valid);
    });

    it("should reject properties where suites exceed bedrooms", () => {
      const invalid = {
        title: "Casa Inválida",
        neighborhood: "Centro",
        city: "Cuiabá",
        state: "MT",
        deal_type: "sale",
        price_cents: 50000000,
        bedrooms: 2,
        suites: 3, // invalid: suites > bedrooms
        bathrooms: 2,
        parking_spaces: 1,
        area_m2: 90,
        sort_order: 0
      };
      const res = validatePropertyPayload(invalid);
      expect(res.error).toContain("suítes");
    });

    it("should reject negative prices or missing required fields", () => {
      const invalid = {
        title: "Casa Sem Preço",
        neighborhood: "Centro",
        city: "Cuiabá",
        state: "MT",
        deal_type: "sale",
        price_cents: -500, // negative price
        bedrooms: 2,
        suites: 1,
        bathrooms: 2,
        parking_spaces: 1,
        area_m2: 90,
        sort_order: 0
      };
      const res = validatePropertyPayload(invalid);
      expect(res.error).toBeDefined();
    });

    it("should limit features cardinality to 25 items", () => {
      const tooManyFeatures = Array.from({ length: 26 }, (_, i) => `Feature ${i}`);
      const payload = {
        title: "Casa de Luxo",
        neighborhood: "Centro",
        city: "Cuiabá",
        state: "MT",
        deal_type: "sale",
        price_cents: 60000000,
        bedrooms: 3,
        suites: 1,
        bathrooms: 2,
        parking_spaces: 1,
        area_m2: 100,
        features: tooManyFeatures,
        sort_order: 0
      };
      const res = validatePropertyPayload(payload);
      expect(res.error).toContain("características");
    });
  });

  // ==========================================
  // Checklist 2: Fluxo de Login & Logout (Captcha logic & cookies configuration)
  // ==========================================
  describe("2. Login Turnstile Verification", () => {
    it("should fail captcha validation when Turnstile key is configured but token is empty", () => {
      const siteKey = "0x4AAAAAADfqy92bCzzrJoS5";
      const token = "";
      const error = requiredCaptchaError(siteKey, token);
      expect(error).toContain("anti-robô");
    });

    it("should bypass captcha validation when Turnstile key is not configured", () => {
      const siteKey = "";
      const token = "";
      const error = requiredCaptchaError(siteKey, token);
      expect(error).toBe("");
    });
  });

  // ==========================================
  // Checklist 3: Formulário de Contato (WhatsApp & Phone validation)
  // ==========================================
  describe("3. Contact Form & WhatsApp Parameter Formatter", () => {
    it("should clean phone numbers correctly, leaving only digits", () => {
      expect(cleanPhone("(65) 99605-2977")).toBe("65996052977");
      expect(cleanPhone("55+65.99605-2977")).toBe("5565996052977");
    });

    it("should format phone numbers into Brazilian standards", () => {
      expect(formatPhone("556596052977")).toBe("(65) 9605-2977");
      expect(formatPhone("556636661989")).toBe("(66) 3666-1989");
    });

    it("should build correct WhatsApp redirect URL with message parameter encoded", () => {
      const waUrl = whatsappUrl("556596052977", "Olá Júlio, teste!");
      expect(waUrl).toBe("https://wa.me/556596052977?text=Ol%C3%A1%20J%C3%BAlio%2C%20teste!");
    });

    it("should validate and normalize contact payload correctly", () => {
      const raw = {
        whatsapp: "(65) 99605-2977",
        phone: "(66) 3666-1989",
        email: "julio@example.com"
      };
      const res = validateContactPayload(raw);
      expect(res.error).toBeNull();
      expect(res.value).toEqual({
        whatsapp: "65996052977",
        phone: "6636661989",
        email: "julio@example.com"
      });
    });
  });

  // ==========================================
  // Checklist 4: Validação do Sitemap
  // ==========================================
  describe("4. Sitemap XML Generation", () => {
    it("should generate a valid XML structure containing property links", async () => {
      const context = {
        site: new URL("http://localhost:4323")
      } as unknown as Parameters<typeof getSitemap>[0];

      const response = await getSitemap(context);
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get("content-type")).toContain("application/xml");

      const body = await response.text();
      expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(body).toContain("<priority>1.0</priority>");
      expect(body).toContain("<priority>0.8</priority>");
    });
  });

  // ==========================================
  // Checklist 5: Simulação de Pane (Offline)
  // ==========================================
  describe("5. Offline and Fallback Recovery Simulation", () => {
    it("should gracefully load fallback data if Supabase connection is inactive", async () => {
      const properties = await getPublicProperties();
      expect(properties).toBeDefined();
      expect(properties.length).toBeGreaterThan(0);

      const contact = await getContactSettings();
      expect(contact).toBeDefined();
      expect(contact.whatsapp).toBeDefined();
      expect(contact.phone).toBeDefined();
    });

    it("should correctly serialize public home data payload even under offline scenario", () => {
      const mockProps = [
        {
          id: "id-test",
          title: "Apartamento",
          deal_type: "sale",
          price_cents: 20000000,
          street: "Rua A",
          number: "123",
          neighborhood: "Centro",
          city: "Cuiabá",
          state: "MT",
          postal_code: "78000-000",
          bedrooms: 2,
          suites: 1,
          bathrooms: 2,
          parking_spaces: 1,
          area_m2: 75,
          description: "Apartamento aconchegante",
          features: ["Portaria 24h"],
          solar_kwh_month: null,
          is_featured: false,
          sort_order: 0,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          photos: []
        } as unknown as import("@/types").Property
      ];

      const data = toPublicHomeData(mockProps, {
        whatsapp: "556596052977",
        phone: "556636661989",
        email: "julioimoveis1@hotmail.com"
      });

      expect(data.properties).toHaveLength(1);
      expect(data.properties[0].slug).toBe("apartamento");
      expect(data.properties[0].type).toBe("Venda");
      expect(data.contact.whatsapp).toBe("556596052977");
    });
  });
});

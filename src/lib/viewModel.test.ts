import { describe, expect, it } from "vitest";
import {
  dealTypeToLabel,
  legacyToDealType,
  legacyWhatsappBase,
  normalizeContact,
  publicFeatureLabels,
  toLegacyProperties,
  toLegacyProperty
} from "@/lib/viewModel";
import { DEFAULT_CONTACT } from "@/lib/format";
import type { Property, PropertyPhoto } from "@/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePhoto(overrides: Partial<PropertyPhoto> & { position: number }): PropertyPhoto {
  return {
    id: "photo-1",
    url: "https://cdn.example.com/photo.jpg",
    thumb_url: "https://cdn.example.com/thumb.jpg",
    card_url: "https://cdn.example.com/card.jpg",
    full_url: "https://cdn.example.com/full.jpg",
    ...overrides
  };
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "prop-1",
    title: "Casa no Centro",
    deal_type: "sale",
    price_cents: 50000000,
    street: "Rua das Flores",
    number: "123",
    neighborhood: "Centro",
    city: "Cuiabá",
    state: "MT",
    postal_code: "78000-000",
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 2,
    area_m2: 120,
    description: "Bela casa.",
    features: ["Piscina", "Churrasqueira"],
    solar_kwh_month: null,
    is_featured: false,
    sort_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
    photos: [],
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// dealTypeToLabel
// ---------------------------------------------------------------------------

describe("dealTypeToLabel", () => {
  it('retorna "Aluguel" para "rent"', () => {
    expect(dealTypeToLabel("rent")).toBe("Aluguel");
  });

  it('retorna "Aluguel" para "Aluguel"', () => {
    expect(dealTypeToLabel("Aluguel")).toBe("Aluguel");
  });

  it('retorna "Venda" para "sale"', () => {
    expect(dealTypeToLabel("sale")).toBe("Venda");
  });

  it('retorna "Venda" para string desconhecida', () => {
    expect(dealTypeToLabel("outro")).toBe("Venda");
  });

  it('retorna "Venda" para null', () => {
    expect(dealTypeToLabel(null)).toBe("Venda");
  });

  it('retorna "Venda" para undefined', () => {
    expect(dealTypeToLabel(undefined)).toBe("Venda");
  });

  it('retorna "Venda" para string vazia', () => {
    expect(dealTypeToLabel("")).toBe("Venda");
  });
});

// ---------------------------------------------------------------------------
// legacyToDealType
// ---------------------------------------------------------------------------

describe("legacyToDealType", () => {
  it('converte "Aluguel" para "rent"', () => {
    expect(legacyToDealType("Aluguel")).toBe("rent");
  });

  it('converte "rent" para "rent"', () => {
    expect(legacyToDealType("rent")).toBe("rent");
  });

  it('converte "Venda" para "sale"', () => {
    expect(legacyToDealType("Venda")).toBe("sale");
  });

  it('converte qualquer outro valor para "sale"', () => {
    expect(legacyToDealType("outro")).toBe("sale");
    expect(legacyToDealType("")).toBe("sale");
  });
});

// ---------------------------------------------------------------------------
// toLegacyProperty
// ---------------------------------------------------------------------------

describe("toLegacyProperty", () => {
  it("mapeia os campos básicos corretamente", () => {
    const property = makeProperty();
    const legacy = toLegacyProperty(property);

    expect(legacy.id).toBe("prop-1");
    expect(legacy.title).toBe("Casa no Centro");
    expect(legacy.beds).toBe(3);
    expect(legacy.suites).toBe(1);
    expect(legacy.baths).toBe(2);
    expect(legacy.parking).toBe(2);
    expect(legacy.area).toBe(120);
    expect(legacy.description).toBe("Bela casa.");
    expect(legacy.isFeatured).toBe(false);
    expect(legacy.sortOrder).toBe(0);
    expect(legacy.createdAt).toBe("2024-01-01T00:00:00Z");
    expect(legacy.updatedAt).toBe("2024-06-01T00:00:00Z");
  });

  it("usa o slug do banco quando presente", () => {
    const legacy = toLegacyProperty(makeProperty({ slug: "casa-no-centro-2" }));
    expect(legacy.slug).toBe("casa-no-centro-2");
  });

  it("deriva o slug do título quando o banco não envia slug", () => {
    const legacy = toLegacyProperty(makeProperty({ slug: undefined, title: "Casa no Centro" }));
    expect(legacy.slug).toBe("casa-no-centro");
  });

  it('usa "Imóvel sem título" quando title está ausente', () => {
    const property = makeProperty({ title: "" });
    // O tipo Property exige title string, mas a função trata string vazia
    const legacy = toLegacyProperty({ ...property, title: "" });
    expect(legacy.title).toBe("Imóvel sem título");
  });

  it('usa "Cuiabá" como cidade padrão quando city está vazio', () => {
    const legacy = toLegacyProperty({ ...makeProperty(), city: "" });
    expect(legacy.city).toBe("Cuiabá");
  });

  it('usa "MT" como estado padrão quando state está vazio', () => {
    const legacy = toLegacyProperty({ ...makeProperty(), state: "" });
    expect(legacy.state).toBe("MT");
  });

  it("type/tag/priceNote são Venda para deal_type sale", () => {
    const legacy = toLegacyProperty(makeProperty({ deal_type: "sale" }));
    expect(legacy.type).toBe("Venda");
    expect(legacy.tag).toBe("Venda");
    expect(legacy.priceNote).toBe("Venda");
  });

  it("type/tag/priceNote são Aluguel para deal_type rent", () => {
    const legacy = toLegacyProperty(makeProperty({ deal_type: "rent" }));
    expect(legacy.type).toBe("Aluguel");
    expect(legacy.tag).toBe("Aluguel");
    expect(legacy.priceNote).toBe("Aluguel");
  });

  it("ordena fotos por position antes de mapear", () => {
    const photos: PropertyPhoto[] = [
      makePhoto({ position: 2, url: "https://cdn.example.com/c.jpg" }),
      makePhoto({ position: 0, url: "https://cdn.example.com/a.jpg" }),
      makePhoto({ position: 1, url: "https://cdn.example.com/b.jpg" })
    ];
    const legacy = toLegacyProperty(makeProperty({ photos }));
    expect(legacy.photos[0]).toBe("https://cdn.example.com/a.jpg");
    expect(legacy.photos[1]).toBe("https://cdn.example.com/b.jpg");
    expect(legacy.photos[2]).toBe("https://cdn.example.com/c.jpg");
  });

  it("usa /img/casa1.jpeg como fallback quando não há fotos", () => {
    const legacy = toLegacyProperty(makeProperty({ photos: [] }));
    expect(legacy.photos).toContain("/img/casa1.jpeg");
    expect(legacy.img).toBe("/img/casa1.jpeg");
  });

  it("photoThumbs usa thumb_url quando disponível, cai para url", () => {
    const photos: PropertyPhoto[] = [
      makePhoto({
        position: 0,
        thumb_url: "https://cdn.example.com/t.jpg",
        url: "https://cdn.example.com/orig.jpg"
      })
    ];
    const legacy = toLegacyProperty(makeProperty({ photos }));
    expect(legacy.photoThumbs[0]).toBe("https://cdn.example.com/t.jpg");
  });

  it("photoThumbs cai para photos quando não há thumb_url nem url", () => {
    const photos: PropertyPhoto[] = [
      makePhoto({
        position: 0,
        thumb_url: null,
        card_url: null,
        url: "https://cdn.example.com/orig.jpg"
      })
    ];
    const legacy = toLegacyProperty(makeProperty({ photos }));
    // thumb_url é null mas url existe — deve usar url
    expect(legacy.photoThumbs[0]).toBe("https://cdn.example.com/orig.jpg");
  });

  it("photoCards usa card_url quando disponível", () => {
    const photos: PropertyPhoto[] = [
      makePhoto({ position: 0, card_url: "https://cdn.example.com/card.jpg" })
    ];
    const legacy = toLegacyProperty(makeProperty({ photos }));
    expect(legacy.photoCards[0]).toBe("https://cdn.example.com/card.jpg");
  });

  it("photoFull usa full_url quando disponível", () => {
    const photos: PropertyPhoto[] = [
      makePhoto({ position: 0, full_url: "https://cdn.example.com/full.jpg" })
    ];
    const legacy = toLegacyProperty(makeProperty({ photos }));
    expect(legacy.photoFull[0]).toBe("https://cdn.example.com/full.jpg");
  });

  it("solarKwhMonth é 0 quando solar_kwh_month é null", () => {
    const legacy = toLegacyProperty(makeProperty({ solar_kwh_month: null }));
    expect(legacy.solarKwhMonth).toBe(0);
  });

  it("solarKwhMonth reflete o valor quando definido", () => {
    const legacy = toLegacyProperty(makeProperty({ solar_kwh_month: 350 }));
    expect(legacy.solarKwhMonth).toBe(350);
  });

  it("defaults numéricos são 0 quando campos ausentes", () => {
    const legacy = toLegacyProperty(
      makeProperty({ bedrooms: 0, suites: 0, bathrooms: 0, parking_spaces: 0, area_m2: null })
    );
    expect(legacy.beds).toBe(0);
    expect(legacy.suites).toBe(0);
    expect(legacy.baths).toBe(0);
    expect(legacy.parking).toBe(0);
    expect(legacy.area).toBe(0);
  });

  it("photoRecords preserva o array original de fotos", () => {
    const photos: PropertyPhoto[] = [makePhoto({ position: 0 })];
    const legacy = toLegacyProperty(makeProperty({ photos }));
    expect(legacy.photoRecords).toBe(photos);
  });
});

// ---------------------------------------------------------------------------
// toLegacyProperties
// ---------------------------------------------------------------------------

describe("toLegacyProperties", () => {
  it("mapeia um array de propriedades", () => {
    const properties = [
      makeProperty({ id: "p1", title: "Casa A" }),
      makeProperty({ id: "p2", title: "Casa B" })
    ];
    const result = toLegacyProperties(properties);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("p1");
    expect(result[1].id).toBe("p2");
  });

  it("retorna array vazio para input vazio", () => {
    expect(toLegacyProperties([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// publicFeatureLabels
// ---------------------------------------------------------------------------

describe("publicFeatureLabels", () => {
  it("retorna mensagem default quando features está vazio", () => {
    const result = publicFeatureLabels({ features: [], solarKwhMonth: 0 });
    expect(result).toEqual(["Fale com o Júlio para conhecer os diferenciais."]);
  });

  it("retorna features normais sem modificação quando não há painel solar e solarKwhMonth=0", () => {
    const result = publicFeatureLabels({
      features: ["Piscina", "Churrasqueira"],
      solarKwhMonth: 0
    });
    expect(result).toEqual(["Piscina", "Churrasqueira"]);
  });

  it('remove "Painel solar" da lista quando solarKwhMonth=0', () => {
    const result = publicFeatureLabels({
      features: ["Piscina", "Painel solar", "Churrasqueira"],
      solarKwhMonth: 0
    });
    expect(result).not.toContain("Painel solar");
    expect(result).toContain("Piscina");
    expect(result).toContain("Churrasqueira");
  });

  it('remove "Placa solar" (alias) quando solarKwhMonth=0', () => {
    const result = publicFeatureLabels({
      features: ["Placa solar"],
      solarKwhMonth: 0
    });
    expect(result).toHaveLength(0);
  });

  it('anexa kWh em "Painel solar" quando solarKwhMonth>0', () => {
    const result = publicFeatureLabels({
      features: ["Painel solar", "Piscina"],
      solarKwhMonth: 400
    });
    expect(result).toContain("Painel solar - 400 kWh/mês");
    expect(result).toContain("Piscina");
    expect(result).not.toContain("Painel solar");
  });

  it('trata "Placa solar" como alias de "Painel solar" e anexa kWh', () => {
    const result = publicFeatureLabels({
      features: ["Placa solar"],
      solarKwhMonth: 250
    });
    expect(result).toContain("Painel solar - 250 kWh/mês");
  });

  it("não modifica outras features quando solarKwhMonth>0", () => {
    const result = publicFeatureLabels({
      features: ["Piscina", "Garagem"],
      solarKwhMonth: 100
    });
    expect(result).toEqual(["Piscina", "Garagem"]);
  });
});

// ---------------------------------------------------------------------------
// normalizeContact
// ---------------------------------------------------------------------------

describe("normalizeContact", () => {
  it("limpa formatação dos telefones fornecidos", () => {
    const result = normalizeContact({
      whatsapp: "(65) 9605-2977",
      phone: "(66) 3666-1989",
      email: "teste@exemplo.com"
    });
    expect(result.whatsapp).toBe("6596052977");
    expect(result.phone).toBe("6636661989");
    expect(result.email).toBe("teste@exemplo.com");
  });

  it("usa DEFAULT_CONTACT quando contact é null", () => {
    const result = normalizeContact(null);
    expect(result.whatsapp).toBe(DEFAULT_CONTACT.whatsapp.replace(/\D/g, ""));
    expect(result.phone).toBe(DEFAULT_CONTACT.phone.replace(/\D/g, ""));
    expect(result.email).toBe(DEFAULT_CONTACT.email);
  });

  it("usa DEFAULT_CONTACT quando contact é undefined", () => {
    const result = normalizeContact(undefined);
    expect(result.whatsapp).toBe(DEFAULT_CONTACT.whatsapp.replace(/\D/g, ""));
    expect(result.phone).toBe(DEFAULT_CONTACT.phone.replace(/\D/g, ""));
    expect(result.email).toBe(DEFAULT_CONTACT.email);
  });

  it("usa DEFAULT_CONTACT quando propriedades estão ausentes", () => {
    const result = normalizeContact({});
    expect(result.whatsapp).toBe(DEFAULT_CONTACT.whatsapp.replace(/\D/g, ""));
    expect(result.phone).toBe(DEFAULT_CONTACT.phone.replace(/\D/g, ""));
    expect(result.email).toBe(DEFAULT_CONTACT.email);
  });

  it("email do DEFAULT_CONTACT é preservado quando não fornecido", () => {
    const result = normalizeContact({ whatsapp: "11999999999", phone: "1133333333" });
    expect(result.email).toBe(DEFAULT_CONTACT.email);
  });
});

// ---------------------------------------------------------------------------
// legacyWhatsappBase
// ---------------------------------------------------------------------------

describe("legacyWhatsappBase", () => {
  it("gera URL wa.me com telefone limpo", () => {
    const contact = { whatsapp: "(65) 9605-2977", phone: "6636661989", email: "a@b.com" };
    const url = legacyWhatsappBase(contact);
    expect(url).toBe("https://wa.me/6596052977");
  });

  it("mantém dígitos já limpos", () => {
    const contact = { whatsapp: "556596052977", phone: "556536661989", email: "a@b.com" };
    const url = legacyWhatsappBase(contact);
    expect(url).toBe("https://wa.me/556596052977");
  });

  it("usa DEFAULT_CONTACT quando whatsapp está vazio", () => {
    const contact = { whatsapp: "", phone: "", email: "" };
    const url = legacyWhatsappBase(contact);
    expect(url).toBe(`https://wa.me/${DEFAULT_CONTACT.whatsapp.replace(/\D/g, "")}`);
  });
});

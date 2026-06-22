import { describe, expect, it } from "vitest";
import type { Property } from "@/types";
import { toPublicHomeData, toPublicPropertyData } from "@/lib/server/publicData";

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "property-1",
    title: "Casa Central",
    deal_type: "sale",
    price_cents: 45000000,
    street: "Rua A",
    number: "10",
    neighborhood: "Centro",
    city: "Cuiabá",
    state: "MT",
    postal_code: "78000-000",
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 2,
    area_m2: 120,
    description: "Casa pronta.",
    features: ["Piscina"],
    solar_kwh_month: null,
    is_featured: true,
    sort_order: 0,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
    photos: [
      {
        id: "photo-1",
        position: 0,
        url: "https://cdn.example.com/full.jpg",
        thumb_url: "https://cdn.example.com/thumb.jpg",
        card_url: "https://cdn.example.com/card.jpg",
        full_url: "https://cdn.example.com/full.jpg"
      }
    ],
    ...overrides
  };
}

describe("public data payloads", () => {
  it("normalizes home data before it reaches the browser", () => {
    const payload = toPublicHomeData([makeProperty()], {
      whatsapp: "(65) 9605-2977",
      phone: "(66) 3666-1989",
      email: "julio@example.com"
    });

    expect(payload.properties).toHaveLength(1);
    expect(payload.properties[0]).toMatchObject({
      id: "property-1",
      title: "Casa Central",
      type: "Venda",
      img: "https://cdn.example.com/full.jpg"
    });
    expect(payload.contact).toEqual({
      whatsapp: "6596052977",
      phone: "6636661989",
      email: "julio@example.com"
    });
  });

  it("returns property detail data with normalized contact", () => {
    const payload = toPublicPropertyData(makeProperty({ deal_type: "rent" }), {
      whatsapp: "65 99999-0000",
      phone: "65 3333-0000",
      email: "contato@example.com"
    });

    expect(payload.property?.type).toBe("Aluguel");
    expect(payload.contact.whatsapp).toBe("65999990000");
  });

  it("keeps contact available when the property is not found", () => {
    const payload = toPublicPropertyData(null, {
      whatsapp: "65 99999-0000",
      phone: "65 3333-0000",
      email: "contato@example.com"
    });

    expect(payload.property).toBeNull();
    expect(payload.contact.email).toBe("contato@example.com");
  });
});

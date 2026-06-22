import type { ContactSettings, Property } from "@/types";
import { DEFAULT_CONTACT } from "@/lib/format";

export const fallbackContact: ContactSettings = DEFAULT_CONTACT;

export const fallbackProperties: Property[] = [
  {
    id: "demo-featured",
    title: "Casa térrea premium no Jardim das Américas",
    deal_type: "sale",
    price_cents: 58000000,
    street: "",
    number: "",
    neighborhood: "Jardim das Américas",
    city: "Cuiabá",
    state: "MT",
    postal_code: "",
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 2,
    area_m2: 180,
    description:
      "Imóvel térreo amplo e bem iluminado, em rua tranquila e de fácil acesso. Estrutura sólida, acabamento de qualidade e itens de segurança e economia já instalados.",
    features: [
      "Painel solar",
      "Câmeras de segurança",
      "Cerca elétrica",
      "Piscina",
      "Garagem coberta",
      "Cozinha planejada"
    ],
    solar_kwh_month: 650,
    is_featured: true,
    sort_order: 0,
    photos: [{ url: "/img/casa1.jpeg", alt: "Fachada de casa térrea", position: 0 }]
  },
  {
    id: "demo-1",
    title: "Apartamento moderno no Centro",
    deal_type: "sale",
    price_cents: 42000000,
    street: "",
    number: "",
    neighborhood: "Centro",
    city: "Cuiabá",
    state: "MT",
    postal_code: "",
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 1,
    area_m2: 78,
    description:
      "Apartamento funcional em localização central, ideal para quem busca praticidade no dia a dia.",
    features: ["Elevador", "Sacada", "Área de lazer"],
    solar_kwh_month: null,
    is_featured: false,
    sort_order: 1,
    photos: [
      {
        url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=78",
        alt: "Sala de apartamento moderno",
        position: 0
      }
    ]
  },
  {
    id: "demo-2",
    title: "Casa com quintal no Jardim Itália",
    deal_type: "sale",
    price_cents: 65000000,
    street: "",
    number: "",
    neighborhood: "Jardim Itália",
    city: "Cuiabá",
    state: "MT",
    postal_code: "",
    bedrooms: 3,
    suites: 1,
    bathrooms: 3,
    parking_spaces: 2,
    area_m2: 210,
    description: "Casa ampla com quintal, boa iluminação natural e espaço para receber a família.",
    features: ["Quintal", "Garagem coberta", "Área gourmet"],
    solar_kwh_month: null,
    is_featured: false,
    sort_order: 2,
    photos: [
      {
        url: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=78",
        alt: "Casa com quintal",
        position: 0
      }
    ]
  },
  {
    id: "demo-3",
    title: "Cobertura com vista em Goiabeiras",
    deal_type: "rent",
    price_cents: 280000,
    street: "",
    number: "",
    neighborhood: "Goiabeiras",
    city: "Cuiabá",
    state: "MT",
    postal_code: "",
    bedrooms: 3,
    suites: 1,
    bathrooms: 2,
    parking_spaces: 2,
    area_m2: 140,
    description: "Cobertura para aluguel com vista aberta e ambientes bem distribuídos.",
    features: ["Vista livre", "Sacada", "Condomínio"],
    solar_kwh_month: null,
    is_featured: false,
    sort_order: 3,
    photos: [
      {
        url: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=78",
        alt: "Cobertura com vista",
        position: 0
      }
    ]
  }
];

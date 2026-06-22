insert into public.properties (
  title,
  deal_type,
  price_cents,
  neighborhood,
  city,
  state,
  bedrooms,
  suites,
  bathrooms,
  parking_spaces,
  area_m2,
  description,
  features,
  solar_kwh_month,
  is_featured,
  sort_order
)
values
(
  'Casa térrea premium no Jardim das Américas',
  'sale',
  58000000,
  'Jardim das Américas',
  'Cuiabá',
  'MT',
  3,
  1,
  2,
  2,
  180,
  'Imóvel térreo amplo e bem iluminado, em rua tranquila e de fácil acesso.',
  array['Painel solar', 'Câmeras de segurança', 'Cerca elétrica', 'Piscina', 'Garagem coberta'],
  650,
  true,
  0
);

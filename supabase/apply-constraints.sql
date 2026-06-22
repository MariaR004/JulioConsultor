-- Script de Migração SQL: Mitigação da Vulnerabilidade 4 (Limites de Payload e Validação no Banco)
-- Execute este script no painel "SQL Editor" do seu projeto Supabase.

-- 1. Aplicar restrições à tabela public.site_settings
ALTER TABLE public.site_settings
  DROP CONSTRAINT IF EXISTS whatsapp_length_check,
  DROP CONSTRAINT IF EXISTS phone_length_check,
  DROP CONSTRAINT IF EXISTS email_length_check;

ALTER TABLE public.site_settings
  ADD CONSTRAINT whatsapp_length_check CHECK (char_length(whatsapp) BETWEEN 10 AND 20),
  ADD CONSTRAINT phone_length_check CHECK (char_length(phone) BETWEEN 8 AND 20),
  ADD CONSTRAINT email_length_check CHECK (char_length(email) <= 100);

-- 2. Aplicar restrições à tabela public.properties
ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS title_length_check,
  DROP CONSTRAINT IF EXISTS street_length_check,
  DROP CONSTRAINT IF EXISTS number_length_check,
  DROP CONSTRAINT IF EXISTS neighborhood_length_check,
  DROP CONSTRAINT IF EXISTS city_length_check,
  DROP CONSTRAINT IF EXISTS state_length_check,
  DROP CONSTRAINT IF EXISTS postal_code_length_check,
  DROP CONSTRAINT IF EXISTS description_length_check,
  DROP CONSTRAINT IF EXISTS features_array_check;

ALTER TABLE public.properties
  ADD CONSTRAINT title_length_check CHECK (char_length(title) <= 120),
  ADD CONSTRAINT street_length_check CHECK (street IS NULL OR char_length(street) <= 150),
  ADD CONSTRAINT number_length_check CHECK (number IS NULL OR char_length(number) <= 20),
  ADD CONSTRAINT neighborhood_length_check CHECK (char_length(neighborhood) <= 80),
  ADD CONSTRAINT city_length_check CHECK (char_length(city) <= 80),
  ADD CONSTRAINT state_length_check CHECK (char_length(state) = 2),
  ADD CONSTRAINT postal_code_length_check CHECK (postal_code IS NULL OR char_length(postal_code) <= 15),
  ADD CONSTRAINT description_length_check CHECK (description IS NULL OR char_length(description) <= 6000),
  ADD CONSTRAINT features_array_check CHECK (cardinality(features) <= 25);

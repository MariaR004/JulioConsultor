export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "";

// Domínio canônico do site. A fonte de verdade em runtime é `site` no
// astro.config.mjs (lido via Astro.site/context.site); esta constante é o
// fallback usado quando Astro.site não está disponível. Mantenha os dois iguais.
export const SITE_ORIGIN = "https://julioconsultor.com.br";

export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || SITE_ORIGIN;
export const AUTH_CAPTCHA_PROVIDER = (
  import.meta.env.PUBLIC_AUTH_CAPTCHA_PROVIDER || "turnstile"
).toLowerCase();
export const AUTH_CAPTCHA_SITE_KEY = import.meta.env.PUBLIC_AUTH_CAPTCHA_SITE_KEY || "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

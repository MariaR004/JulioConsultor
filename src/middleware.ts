import { defineMiddleware } from "astro:middleware";

// O arquivo public/_headers só é aplicado às respostas servidas pelo sistema de
// Assets estáticos do Cloudflare. Páginas SSR (/, /admin, /imovel/*) e rotas
// /api/* são geradas pelo Worker e NÃO recebem aqueles headers. Este middleware
// replica os mesmos cabeçalhos de segurança nessas respostas.
//
// IMPORTANTE: mantenha esta lista em sincronia com public/_headers.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; " +
    "script-src 'self' https://challenges.cloudflare.com https://js.hcaptcha.com; " +
    "connect-src 'self' https://byxqgsfbnyhgczrssyxm.supabase.co wss://byxqgsfbnyhgczrssyxm.supabase.co https://challenges.cloudflare.com https://*.hcaptcha.com; " +
    "img-src 'self' data: blob: https://byxqgsfbnyhgczrssyxm.supabase.co; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "frame-src 'self' https://www.google.com https://challenges.cloudflare.com https://*.hcaptcha.com; " +
    "object-src 'none'; base-uri 'self'; form-action 'self';"
};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    // Não sobrescreve um header que a própria rota já tenha definido.
    if (!response.headers.has(key)) response.headers.set(key, value);
  }
  return response;
});

# Júlio Corretor

Frontend Astro para Cloudflare Workers (com assets estáticos), com home, página de imóvel e sitemap renderizados no servidor a cada visita, e painel admin via endpoints server-side. Supabase é usado para autenticação, banco e bucket de fotos.

## Stack

- Astro em modo `server` com adapter Cloudflare. A home, `/imovel/[id]` e `/sitemap.xml` usam `prerender = false` (renderização no servidor a cada requisição), então imóveis cadastrados no painel aparecem imediatamente, sem novo build/deploy. Se o Supabase estiver indisponível, a home responde com a estrutura vazia e o navegador busca os dados (com skeleton e retry).
- Supabase Auth para login administrativo via cookies `HttpOnly`.
- Supabase Postgres com RLS para imóveis, fotos e configurações de contato.
- Supabase Storage no bucket `property-photos`.

## Configuração local

1. Instale dependências:

```powershell
npm.cmd install
```

2. Copie `.env.example` para `.env` e preencha:

```text
PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
PUBLIC_SITE_URL=https://seu-dominio.com
PUBLIC_AUTH_CAPTCHA_PROVIDER=turnstile
PUBLIC_AUTH_CAPTCHA_SITE_KEY=site-key-publica-do-captcha
```

`SUPABASE_SERVICE_ROLE_KEY` é obrigatório para os endpoints `/api/admin/*`, mas deve existir apenas no ambiente server-side local/Cloudflare. Nunca crie uma variável `PUBLIC_` para essa chave e nunca a use em código de navegador.

3. Rode o projeto:

```powershell
npm.cmd run dev
```

O script `dev` fica preso em `127.0.0.1`. Não rode `astro dev --host 0.0.0.0` neste projeto, porque o servidor de desenvolvimento pode expor arquivos da raiz do repositório em rede local.

## Supabase

1. Crie um projeto no Supabase.
2. Execute `supabase/schema.sql` no SQL Editor.
3. Em Authentication, crie o usuário do admin.
4. Pegue o UUID desse usuário e execute:

```sql
insert into public.admin_users (user_id)
values ('UUID_DO_USUARIO');
```

Sem esse passo, o login autentica, mas o painel continua sem permissão administrativa.

## Cloudflare Workers

O deploy é realizado como um Cloudflare Worker (com Assets Estáticos) utilizando o arquivo de configuração `wrangler.json` na raiz do projeto:

- Instale o Wrangler e faça login: `npx wrangler login`
- Configure as variáveis `PUBLIC_*` no arquivo `.env` (elas são injetadas no momento do build).
- Configure a variável secreta no Cloudflare: `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`
- Compile e publique com: `npm run build` e depois `npx wrangler deploy`

Configure `SUPABASE_SERVICE_ROLE_KEY` como variável secreta server-side do Cloudflare Worker. O frontend continua recebendo apenas variáveis `PUBLIC_*` embutidas no build.

### Valores acoplados ao projeto/domínio

Alguns arquivos são estáticos e não leem variáveis de ambiente. Ao trocar de projeto Supabase ou de domínio, atualize manualmente:

- `public/_headers` — a `Content-Security-Policy` lista a URL do projeto Supabase (`https://<projeto>.supabase.co` em `script-src`/`connect-src`/`img-src`). Precisa bater com `PUBLIC_SUPABASE_URL`.
- `astro.config.mjs` — o campo `site` define o domínio usado em `og:image`, `og:url`, `canonical` e no `sitemap.xml`.
- `public/robots.txt` — a linha `Sitemap:` aponta para o domínio.

## Observações de segurança

### Protecao contra forca bruta no login admin

- Em Supabase Dashboard > Authentication > Rate Limits, revise e reduza os limites dos endpoints de Auth conforme o risco do projeto.
- Em Supabase Dashboard > Project Settings > Authentication > Bot and Abuse Protection, ative CAPTCHA.
- Use `PUBLIC_AUTH_CAPTCHA_PROVIDER=turnstile` ou `hcaptcha` e preencha `PUBLIC_AUTH_CAPTCHA_SITE_KEY` com a site key publica do provedor.
- Cadastre a secret key do CAPTCHA no dashboard do Supabase. A secret key nunca deve ir para `.env` publico nem para o frontend.

- Todo imóvel salvo no painel aparece no site público.
- O admin só consegue CRUD se estiver autenticado e cadastrado em `admin_users`.
- O bucket é público para leitura, mas upload/update/delete exigem admin.
- O upload no painel converte imagens novas para WebP no navegador, com maior lado em atÃ© 2400 px e qualidade 0.9, antes de enviar para reduzir storage e egress sem degradar a galeria grande.

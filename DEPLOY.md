# Tutorial de deploy — Cloudflare Workers + Supabase

Guia passo a passo para colocar o site no ar. O repositório já está conectado ao
GitHub (`x-Sant/corretor`) e o Supabase já está configurado e funcionando — este
guia indica o que conferir em cada um.

---

## 1. Antes de começar: suba o código para o GitHub

O deploy é realizado utilizando a ferramenta CLI `wrangler` da Cloudflare (ou via GitHub Actions). Garanta que seu código esteja commitado e enviado ao repositório:

```powershell
git add .
git commit -m "sua mensagem"
git push origin main
```

---

## 2. Supabase — o que conferir (quase nada precisa mudar)

O projeto Supabase já está em produção (schema aplicado, admin criado, bucket
funcionando). O site público lê os dados com a chave `anon` + RLS, que já é o
mesmo mecanismo usado hoje — **nenhuma mudança no Supabase é necessária para o
deploy em si**. A checklist abaixo é de segurança e limpeza:

### 2.1 Ativar o CAPTCHA no login (recomendado)

1. Acesse **Dashboard > Project Settings > Authentication**.
2. Em **Bot and Abuse Protection**, ative **Enable CAPTCHA protection**.
3. Escolha **Turnstile** como provedor.
4. Cole a **secret key** do widget Turnstile (obtida no passo 4 deste guia).
   - A secret key fica **somente** no dashboard do Supabase. Nunca no `.env`
     nem no Cloudflare Workers.

### 2.2 Reduzir os rate limits de autenticação (recomendado)

Em **Authentication > Rate Limits**, reduza os limites dos endpoints de login
(ex.: 5–10 tentativas de token por hora por IP). Só o admin faz login no site,
então limites apertados não atrapalham visitantes.

### 2.3 Remover dados de teste (antes de divulgar o site)

Se houver imóveis de teste cadastrados (ex.: "Casa teste 2"), exclua-os pelo
painel admin — tudo o que está na tabela `properties` aparece no site público.

### 2.4 Conferências rápidas (já devem estar OK)

- `supabase/schema.sql` aplicado no SQL Editor.
- Usuário do admin criado em **Authentication > Users** e inserido na tabela
  `admin_users` (`insert into public.admin_users (user_id) values ('UUID');`).
- Bucket `property-photos` existente, com leitura pública.

---

## 3. Cloudflare Workers — Criar o projeto e fazer o deploy

Com a nova arquitetura do `@astrojs/cloudflare` (v13+), o deploy do site com renderização no servidor (SSR) agora é feito na plataforma **Cloudflare Workers** (Workers com Assets) e não mais em Pages.

### 3.1 Login no Cloudflare localmente

Pelo terminal na pasta do projeto, faça login na sua conta do Cloudflare:

```powershell
npx wrangler login
```

### 3.2 Como o build funciona

O arquivo `wrangler.json` na raiz do projeto já está configurado. O build do Astro gera a pasta `dist/client` com os arquivos estáticos e `dist/server/entry.mjs` com o código do servidor.

### 3.3 Configuração das Variáveis de Ambiente e Segredos

As variáveis iniciadas com `PUBLIC_` são embutidas pelo Astro durante o build. Crie ou edite o arquivo `.env` localmente antes de rodar o build:

| Variável                       | Valor                                              | Tipo  |
| ------------------------------ | -------------------------------------------------- | ----- |
| `PUBLIC_SUPABASE_URL`          | `https://byxqgsfbnyhgczrssyxm.supabase.co`         | Texto |
| `PUBLIC_SUPABASE_ANON_KEY`     | a anon key do Supabase (Project Settings > API)    | Texto |
| `PUBLIC_SITE_URL`              | `https://julio-consultor.<subdominio>.workers.dev` | Texto |
| `PUBLIC_AUTH_CAPTCHA_PROVIDER` | `turnstile`                                        | Texto |
| `PUBLIC_AUTH_CAPTCHA_SITE_KEY` | a site key do widget Turnstile                     | Texto |

> **Atenção:** `PUBLIC_SITE_URL` deve conter a URL final do seu Worker (ex: `https://julio-consultor.seu-subdominio.workers.dev` ou seu domínio próprio).

Para a chave secreta `SUPABASE_SERVICE_ROLE_KEY`, ela é acessada apenas no servidor e deve ser configurada diretamente no Cloudflare como um **Segredo (Secret)**:

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

_(Digite a chave `service_role` do Supabase quando solicitado no terminal)_

Atenção:

- As variáveis `PUBLIC_*` são embutidas no código no momento do build. Se alterar alguma depois, é preciso rodar um novo build e deploy para ter efeito.
- Você também pode gerenciar variáveis e segredos no painel do Cloudflare em **Workers & Pages > (seu worker) > Settings > Variables**.

### 3.4 Executando o Deploy

Para compilar e publicar o site:

```powershell
npm run build
npx wrangler deploy
```

---

## 4. Turnstile (CAPTCHA) — criar o widget

O CAPTCHA protege o login do admin contra força bruta. É gratuito:

1. No dashboard do Cloudflare, vá em **Turnstile > Add widget**.
2. **Hostnames permitidos**: adicione `julio-consultor.<subdominio>.workers.dev` (e
   `localhost` + `127.0.0.1` se quiser testar o CAPTCHA localmente).
3. Modo: **Managed** (recomendado).
4. Ao criar, o Cloudflare mostra duas chaves:
   - **Site key** (pública) → vai em `PUBLIC_AUTH_CAPTCHA_SITE_KEY` no `.env` local e nas variáveis de ambiente.
   - **Secret key** → vai **somente** no Supabase (passo 2.1).

> Se já existe um widget criado para desenvolvimento, basta editar os
> hostnames dele para incluir o domínio de produção.

---

## 5. Depois do deploy — testes de fumaça

Acesse `https://julio-consultor.<subdominio>.workers.dev` e verifique:

1. **Home** carrega com a lista de imóveis.
2. **Clicar em um imóvel** abre a página de detalhe (renderizada no servidor).
3. **`/sitemap.xml`** responde com a lista de URLs.
4. **`/admin`** abre a tela de login; faça login e confirme que o painel
   carrega.
5. **Cadastre um imóvel de teste** no painel e confirme que ele aparece na
   home e que a página de detalhe abre **sem precisar de novo deploy**.
   Depois exclua o teste.
6. Abra o DevTools (F12) > aba Network e confirme que a resposta da home tem
   os headers de segurança (`content-security-policy`,
   `strict-transport-security` etc. — vêm do `public/_headers`).

A partir daqui, você pode configurar um pipeline no GitHub Actions com a Action oficial `cloudflare/wrangler-action` para fazer deploy automático a cada `git push` na branch `main`.

---

## 6. Quando tiver domínio próprio (futuro)

1. No painel do Worker: Vá em **Triggers > Custom Domains > Add Custom Domain** e siga as instruções de DNS.
2. Atualize no código (e faça push):
   - `astro.config.mjs` → campo `site`
   - `public/robots.txt` → linha `Sitemap:`
3. Atualize a variável `PUBLIC_SITE_URL` no `.env` (e refaça o build/deploy).
4. Adicione o novo domínio aos hostnames do widget Turnstile.
5. O `public/_headers` (CSP) só precisa mudar se o **projeto Supabase**
   mudar, não o domínio do site.

---

## 7. Problemas comuns

| Sintoma                                      | Causa provável                                                       | Solução                                       |
| -------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| Build falha com erro de conexão Supabase     | Variáveis `PUBLIC_SUPABASE_*` ausentes/erradas                       | Conferir variáveis e refazer o build e deploy |
| Login do admin retorna erro 500              | `SUPABASE_SERVICE_ROLE_KEY` não configurada                          | Adicionar como secret via Wrangler            |
| Login autentica mas painel diz sem permissão | Usuário não está na tabela `admin_users`                             | Rodar o `insert` do passo 2.4                 |
| CAPTCHA não aparece ou recusa                | Hostname do site não está no widget Turnstile                        | Adicionar o domínio nos hostnames do widget   |
| Imagens dos imóveis não carregam             | URL do Supabase no CSP (`public/_headers`) diferente do projeto real | Alinhar `_headers` com `PUBLIC_SUPABASE_URL`  |
| Mudou variável `PUBLIC_*` e nada aconteceu   | Elas são embutidas no build                                          | Rodar novo build e deploy                     |

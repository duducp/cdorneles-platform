# ADR-015: MFA Challenge/Verify via Stock Appwrite Endpoints

## Status

Accepted

## Context

O fluxo MFA foi quebrado por uma regressão silenciosa. A spec original
(`docs/superpowers/specs/2026-09-19-password-recovery-and-mfa-design.md`)
definia `createMfaChallenge`/`completeMfa` como chamadas **stock** do SDK
Appwrite, com a cookie de sessão pendente do navegador. A spec do Turnstile
(`2026-09-27-turnstile-public-forms-design.md`) moveu `mfaChallenge`/`mfaVerify`
para dentro da function `public-auth` (deny-by-default atrás do siteverify),
commits `75528a4`/`79de07f`.

A mudança passou em todos os testes unitários e **nunca foi smoke-testada de
ponta a ponta**. O resultado, meses depois:

1. Login com fator extra pendente grava uma cookie httpOnly de sessão
   pendente no navegador (origin `console.cdorneles.com.br`).
2. A tela `/mfa` chama `publicMfaChallenge` — a function recebe o JWT de
   handoff, mas a **cookie de sessão pendente é httpOnly e nunca chega ao
   servidor**; a chamada server-side ao Appwrite não tem sessão.
3. Appwrite responde 401 `USER_MORE_FACTORS_REQUIRED` (stock
   `errors.php:330-335`).
4. `isUnauthorized` em `packages/api-client/src/errors.ts` mapeava **qualquer**
   401 para "sessão expirada" → redirect `/login?notice=session-expired`.
   Usuário nunca via a tela de MFA — "Sessão não encontrada".

Duas causas-raiz independentes: (a) o proxy na function não pode reproduzir o
contexto de sessão pendente do navegador; (b) o mapeamento de erro tratava um
estado legítimo de MFA como expiração.

## Decision

1. **`createMfaChallenge`/`completeMfa` chamam os endpoints stock do Appwrite
   diretamente do cliente**, com a cookie de sessão pendente:
   - `POST /v1/account/mfa/challenges` (SDK `accountApi.createMfaChallenge`)
     cria o desafio TOTP/e-mail na mesma sessão pendente.
   - `PUT /v1/account/mfa/challenges` (SDK `accountApi.updateMfaChallenge`)
     valida o OTP e **atualiza os fatores na mesma sessão**
     (`Update.php:171-175`) → a sessão existente passa a ser válida e
     `GET /v1/account/me` desbloqueia sem troca de cookie.
   - Eles **não** passam pela `public-auth` e **não** enviam `turnstileToken`.
     Tradeoff aceito: Turnstile cai nestas 2 chamadas. Compensação: a sessão
   pendente só existe após `login` bem-sucedido, é httpOnly e curta; o
   abuse-limit stock (10 chamadas por usuário/URL, `Create.php:95`) limita
   tentativas; o OTP continua sendo o fator de verdade.
   - `login`, `requestRecovery` e `completeRecovery` continuam deny-by-default
     na `public-auth` com Turnstile.
2. **`isUnauthorized` não pode mapear `user_more_factors_required` para
   sessão expirada** — retornar `false` antes do check de 401
   (`packages/api-client/src/errors.ts`).
3. **`functionsApi.publicMfaChallenge`/`publicMfaVerify` (e os handlers Go
   `MfaChallenge`/`MfaVerify`) ficam órfãos de uso no frontend** — mantidos
   no commit do fix; **follow-up concluído**: as ações `mfaChallenge`/`mfaVerify`
   foram aposentadas da `public-auth` (handlers Go, structs, interface
   `operations` e o client TS `FunctionsApi` removidos). A action agora
   responde `400 unknown action`; o restante da MFA roda só nos endpoints
   stock do Appwrite, com a cookie de sessão pendente do navegador.

## Prevention (para a regressão não se repetir)

1. **Nunca mova um fluxo de auth funcional para trás de uma nova fronteira
   (function/BFF/proxy) sem um smoke E2E real.** Testes unitários passaram em
   100% durante a regressão: mocks não reproduzem cookies httpOnly nem
   contexto de sessão. Regra prática: se o fluxo depende de cookie/estado de
   navegador, ele não pode ser movido para o servidor sem reprovado em smoke.
2. **Sessão pendente MFA nunca sai do navegador.** Qualquer design que exija
   a function agir *com* a sessão pendente do usuário está errado — não há
   como forjar isso sem abrir bypass de MFA.
3. **401 ≠ sempre sessão expirada.** Ao adicionar mapeamento de erro de auth,
   listar os códigos Appwrite que significam outro estado
   (`user_more_factors_required` etc.) e testá-los.
4. **Header de server-key do Appwrite é `X-Appwrite-Key`**, nunca `X-Api-Key`
   (causa-raiz #4: a function rodava sem credencial e chamadas autenticadas
   falhavam em silêncio).
5. **Vitest (esbuild) não faz typecheck.** Erros de tipo só aparecem em
   `pnpm typecheck`; rodar os dois. E após qualquer refactor de chamada,
   grep em `toHaveBeenCalledWith` — asserções antigas passam a falhar só no
   arquivo que as mantém.

## Consequences

- `/mfa` funciona de ponta a ponta sem redirecionar para
  `?notice=session-expired`; verificação de OTP desbloqueia a mesma sessão.
- Turnstile não cobre challenge/verify (documentado em
  `docs/authentication/README.md`); se isso virar requisito, a saída é um BFF
  com a cookie re-emitida (opção C, rejeitada hoje — ver abaixo).
- `public-auth` fica com 3 ações (`login`, `requestRecovery`,
  `completeRecovery`); os handlers MFA e o escopo `mfa.*` da function viram
  código morto até o follow-up de aposentadoria.
- Alternativas rejeitadas:
  - **B (function resolve o usuário pelo JWT):** o handoff JWT não traz os
    fatores pendentes sem chamar endpoints que exigem sessão — circular.
  - **C (BFF + Turnstile):** a cookie httpOnly nunca chega em
    `localhost:3001` cross-site; exigiria re-emitir sessão no BFF (novo
    surface de sequestro).

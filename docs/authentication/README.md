# Authentication

Authentication is provided by Appwrite.

Initial requirements:

- email/password;
- MFA from the beginning;
- no social login initially;
- email verification is not mandatory;
- Appwrite native password recovery;
- deactivation must invalidate access as required by the security model.

Frontend authentication helpers belong in `@cdorneles/auth`.

## Sessão morta com o app rodando

Quando a sessão morre enquanto o usuário está dentro do sistema, o app **não
navega**. Um diálogo sobre a página pede a senha e cria uma nova sessão, para
que formulários preenchidos e rascunhos não se percam.

Duas entradas levam ao diálogo:

- o poll periódico do `AuthProvider`, que consulta o servidor (uma sessão pode
  ser revogada — senha trocada, logout em outro dispositivo — antes de o
  timestamp local indicar expiração);
- um `401` em qualquer query ou mutation, capturado centralmente pelo
  `QueryCache`/`MutationCache` do `createQueryClient` e levado ao auth pelo
  `createSessionSignal`.

Uma carga nova **sem** sessão continua redirecionando para `/login`: não há
página anterior a preservar nem identidade conhecida para preencher o e-mail.

`renewSession` (`account.updateSession('current')`) estende uma sessão que
**ainda é válida** e não pede senha — é o que o aviso de expiração usa.
Reautenticar só é necessário quando a sessão já morreu.

## Duração de sessão

A fronteira de expiração é a **duração de sessão do Appwrite**, configurada em
**Auth → Security → Session duration** para **24h** (`project_update_session_duration_policy`).
Sessões existentes mantêm o vencimento original; só as novas usam 24h.
`account.updateSession('current')` (o `renewSession`) estende uma sessão ainda
válida, então quem está ativo nunca é deslogado no meio do trabalho.

## Criação de organização

Criar uma organização exige a capability `organizations.create`. Ela é uma
capability de **plataforma**, não de papel de organização: o `resolve-grants`
tem um modo de plataforma (um `organizationId` vazio) que a devolve para quem
é membro do time de plataforma — o `NEXT_PUBLIC_PLATFORM_TEAM_ID` configurado na função.

O time de plataforma é configurado no app por `NEXT_PUBLIC_PLATFORM_TEAM_ID` e
é **excluído** da lista de organizações, então nunca aparece como uma
organização.

Em `/select-org`: sem nenhuma organização, a tela mostra "Nenhuma organização
vinculada. Fale com um administrador."; o botão "Create organization" só
aparece com a capability.

O gate é **UX, não segurança** (AGENTS.md): a criação continua rodando no
cliente (`TeamsApi.createTeam` + `provision-organization`). Mover a criação
para trás de uma Function é a fronteira real.

## Gerenciamento de usuários

Permissões são chaves `recurso.ação`. No modelo estilo Django, um usuário recebe
permissões de duas formas: pelos **papéis** (os "grupos") e por **concessões
diretas**. As permissões **efetivas** são a **união** das chaves dos papéis do
usuário (`role_permissions`) com as chaves concedidas diretamente a ele (tabela
`user_permissions`) — a mesma união que o `resolve-grants` devolve. Não há
negação: a concessão apenas soma.

O **root da plataforma** é membro do time de plataforma (`NEXT_PUBLIC_PLATFORM_TEAM_ID`) e
tem **todas** as permissões, como o superuser do Django. O modo de plataforma do
`resolve-grants` é acionado pela **membership** no time, chamado com um
`organizationId` vazio, e devolve todas as chaves da tabela `permissions`. Um
`organizationId` vazio sozinho não concede nada: quem não é do time recebe lista
vazia.

As capabilities `users.read`, `users.create` e `users.manage_permissions` **não
são concedidas por papel de organização** — ficam de fora do
`allPermissionIDs()` do `provision-organization`, então nenhum papel semeado as
carrega. Só o time de plataforma as tem de graça. Cada Function as resolve de um
jeito: `create-user` e `update-user-permissions` checam as permissões
**efetivas do chamador na organização** (papéis ∪ concessões diretas), então uma
concessão **direta** basta; `list-users` resolve contra os grants de plataforma
(organização vazia) e é, na prática, exclusivo do time de plataforma.

O rótulo `root` é **apenas um marcador**, nunca um grant (AGENTS.md: autorizar
por capability, nunca por rótulo ou nome de papel). Toda Function reautoriza no
servidor; o gate da UI é só UX.

## Funções de gerenciamento de usuários

Três Functions fazem o trabalho privilegiado. Todas identificam o chamador pelo
`x-appwrite-user-id` e negam sem a capability exigida:

- `create-user` — cria o usuário no Appwrite, adiciona a membership na
  organização com o papel, grava as concessões diretas e envia o e-mail de
  boas-vindas com a senha temporária. Exige `users.create`; quando a requisição
  traz `permissions`, exige também `users.manage_permissions`, e o chamador só
  pode conceder chaves que ele mesmo possui.
- `update-user-permissions` — reconcilia as concessões diretas de um usuário
  (`{ userId, organizationId, permissions }`): revoga as que saíram, concede as
  que faltam e não toca no que não mudou. Exige `users.manage_permissions`
  (mesma regra de só conceder chaves que o chamador possui).
- `list-users` — pagina o `users.list` do servidor e devolve
  `{ users: [{ id, email, name, labels }] }`. Exige `users.read`.

## Página de usuários (admin)

Em `apps/admin` → `/users`, a página lista os usuários e permite criar um novo.
O gate é **UX, não segurança** (AGENTS.md): a lista aparece com `users.read`, o
botão "New user" com `users.create`, e a lista de permissões do formulário só
aparece com `users.manage_permissions`. O formulário pede e-mail, nome,
organização, papel (`owner|admin|member`) e as permissões diretas.

Está **fora de escopo**: auto-cadastro, negação por usuário, editar o papel ou a
organização de um usuário depois de criado, e excluir ou desativar usuários.
Editar as permissões de um usuário depois de criado ainda não está exposto: o
cliente já tem `updateUserPermissions`, mas nenhuma tela o chama.

## Turnstile (gate das páginas públicas)

Toda ação pública de autenticação (`login`, `mfaChallenge`, `mfaVerify`,
`requestRecovery`, `completeRecovery`) roda na function Appwrite `public-auth`,
que só executa depois do siteverify do Cloudflare Turnstile — **deny-by-default**
(AGENTS.md: a function é a fronteira de segurança, o frontend é só UX).

### Variáveis de ambiente

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — site key (browser) do widget, **por app**
  (`admin`, `client`, `design-system` reusam as mesmas páginas); é inlined no
  build, então mudar exige redeploy.
- `TURNSTILE_SECRET_KEY` — secret do siteverify, **server-side**, em
  function Settings → Variables da `public-auth`. Nunca em `NEXT_PUBLIC_*`.

Para desenvolvimento, o `.env.example` traz as test keys oficiais do Cloudflare
(que sempre passam e que sempre falham).

### Comportamento em falha (fail-closed)

- Sem `TURNSTILE_SECRET_KEY` na function → `500 turnstile_not_configured`.
- Sem site key no app → o form mostra "Verificação de segurança não configurada
  neste ambiente." ao submeter; o login nunca acontece silenciosamente.
- Token rejeitado pelo Cloudflare → `403 invalid_turnstile_token`, com mensagem
  própria no `describeAuthError`.
- Siteverify inalcançável → `502 turnstile_verification_failed`.

Os textos novos vivem em `@cdorneles/auth` (`describe-error.ts`) e no widget
(`packages/ui/src/components/turnstile.tsx`); nenhum texto de erro existente
mudou.

### Aparência do widget

O widget é renderizado com `appearance: "interaction-only"` (pinado em
`packages/ui/src/components/turnstile.test.tsx`): o container só fica visível
quando a análise de risco do Cloudflare exige interação do usuário; no fluxo
comum ele permanece invisível. O widget type (Managed/Invisible/etc.) continua
sendo escolhido no dashboard da Cloudflare por site key.

### Sessão pendente ausente em /mfa

O login de uma conta MFA entrega ao browser uma **sessão pendente** (um fator),
que o `/mfa` usa para listar fatores e criar o desafio. Se ela não estiver lá
( cookie limpo, sessão expirada ou revogada, `/mfa` aberto direto), o bootstrap
da página responde 401. Nesse caso a página **não** mostra um beco sem saída:
faz logout, limpa o estado e redireciona para
`/login?notice=session-expired&redirect=<path>`; o login anuncia o motivo no
`FormError` do formulário ("Sessão não encontrada. Faça login novamente para
iniciar a verificação em duas etapas."). O `redirect` preserva o destino
depois do novo login (mesma validação do `resolvePostAuthRedirect`).

### Tokens single-use

Cada token do Turnstile é single-use e expira em 300s. A tela é dona de **um**
widget (`useTurnstile`) e cada chamada de service consome um token via
`nextToken()`, que dispara o reset imediatamente para pré-mintar o próximo.

### Checklist de deploy

1. Criar o widget no Cloudflare e obter as chaves reais (dev: test keys).
2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no env de build de `admin`, `client` e
   `design-system`.
3. `TURNSTILE_SECRET_KEY` em Settings → Variables da function `public-auth`.
4. `make -C functions deploy public-auth`.
5. Smoke: `/login`, `/forgot-password`, `/reset-password`, `/mfa` e o
   `SessionExpiredGate` (senha + MFA) com o widget visível e token válido; com a
   secret vazia → erro de configuração, nunca login silencioso.

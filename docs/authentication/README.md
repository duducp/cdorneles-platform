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

## Bloqueio por inatividade

Depois de **15 minutos** (configurável por `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES`)
sem atividade, a tela avisa por **30 segundos** (`NEXT_PUBLIC_IDLE_PROMPT_SECONDS`,
com countdown e botão "Continuar trabalhando") e então **bloqueia**. Para continuar,
o usuário digita a senha (e o código, se tiver MFA) — sempre, mesmo que a sessão
ainda esteja válida. A detecção é do `react-idle-timer` (`crossTab`), então
qualquer aba ativa mantém todas desbloqueadas.

O bloqueio é **UX, não segurança** (AGENTS.md): desencoraja quem se afastou da
mesa. A fronteira real é a **duração de sessão do Appwrite**, configurada em
**Auth → Security → Session duration** para **24h** (`project_update_session_duration_policy`).
Sessões existentes mantêm o vencimento original; só as novas usam 24h.
`account.updateSession('current')` (o `renewSession`) estende uma sessão ainda
válida, então quem está ativo nunca é deslogado no meio do trabalho.

## Criação de organização

Criar uma organização exige a capability `organizations.create`. Ela é uma
capability de **plataforma**, não de papel de organização: o `resolve-grants`
tem um modo de plataforma (um `organizationId` vazio) que a devolve para quem
é membro do time de plataforma — o `PLATFORM_TEAM_ID` configurado na função.

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

O **root da plataforma** é membro do time de plataforma (`PLATFORM_TEAM_ID`) e
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

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

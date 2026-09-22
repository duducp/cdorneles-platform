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

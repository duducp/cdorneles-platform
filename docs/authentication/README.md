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

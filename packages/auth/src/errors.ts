/**
 * Thrown when Appwrite reports that more authentication factors are required
 * (e.g. MFA challenge needed). The login flow catches this and redirects to
 * the MFA challenge page.
 */
export class MfaRequiredError extends Error {
  constructor(message = "MFA challenge required") {
    super(message);
    this.name = "MfaRequiredError";
  }
}

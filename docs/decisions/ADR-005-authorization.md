# ADR-005: Layered Authorization

## Status

Accepted

## Decision

Use Appwrite permissions for resource/data access where appropriate and a platform-level business permission model for domain capabilities.

Business permissions use `resource.action` keys.

Examples:

```text
customers.read
orders.create
invoices.approve
```

Appwrite Functions are the security boundary.

Frontend permission checks are UX only.

## Effective Access

```text
authenticated
AND membership
AND organization active
AND application access
AND permission
AND feature enabled
```

## Consequences

The platform benefits from Appwrite's native resource permissions without forcing all ERP business capabilities into Appwrite's primitive permission model.

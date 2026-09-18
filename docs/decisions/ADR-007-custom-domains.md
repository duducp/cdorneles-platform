# ADR-007: Domain Resolution

## Status

Accepted

## Decision

Standard Cdorneles domains identify the application:

```text
admin.cdorneles.com.br
client.cdorneles.com.br
customer.cdorneles.com.br
```

A custom domain identifies the Organization.

Each Organization may have one custom domain.

A custom domain does not permanently identify a specific application. After authentication, available applications are determined by the user's access within that Organization.

## Consequences

Domain resolution remains simple and avoids creating one domain mapping per panel.

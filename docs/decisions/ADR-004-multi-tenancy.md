# ADR-004: Appwrite Team Represents Organization

## Status

Accepted

## Decision

An Organization is represented by an Appwrite Team.

Appwrite Team membership represents the user-to-organization relationship.

Do not create duplicate `organizations` or `memberships` tables unless a future requirement explicitly needs a projection.

## Consequences

Identity, membership, and organization boundaries use Appwrite-native concepts.

A user can belong to multiple organizations.

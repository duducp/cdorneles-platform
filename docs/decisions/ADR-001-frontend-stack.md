# ADR-001: Frontend Stack

## Status

Accepted

## Context

The platform requires multiple consistent Next.js applications with a shared design system and strong TypeScript support.

## Decision

Use:

- Next.js
- TypeScript
- pnpm
- Mantine
- Lucide
- TanStack Query
- TanStack Table
- Mantine Form
- Zod
- Zustand only when genuinely needed
- ESLint
- Prettier

Do not use Tailwind or shadcn/ui.

## Consequences

The platform gets a single UI foundation and avoids multiple competing styling systems.

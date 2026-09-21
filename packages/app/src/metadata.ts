import type { Metadata } from "next";

/**
 * The root metadata shared by every app: the platform title template and the
 * favicon. Page-level titles slot into `%s`, so /login renders as
 * "Entrar | Cdorneles".
 */
export function createMetadata(input: { title: string; description: string }): Metadata {
  return {
    title: { default: input.title, template: "%s | Cdorneles" },
    description: input.description,
    icons: { icon: "/brand/favicon.png" },
  };
}

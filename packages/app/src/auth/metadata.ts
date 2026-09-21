import type { Metadata } from "next";

/**
 * Page metadata for the auth screens.
 *
 * Deliberately free of `"use client"`: a server `page.tsx` re-exports these,
 * and a client module would hand it a client reference instead of the object.
 */
export const loginMetadata: Metadata = { title: "Entrar" };
export const mfaMetadata: Metadata = { title: "Verificação em duas etapas" };
export const forgotPasswordMetadata: Metadata = { title: "Recuperar senha" };
export const resetPasswordMetadata: Metadata = { title: "Redefinir senha" };

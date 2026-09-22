import { Inter } from "next/font/google";

/**
 * Inter is the platform typeface (Guia de Identidade Visual §10). It is exposed
 * as `--font-inter`, which the `@cdorneles/tokens` sans stack references.
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

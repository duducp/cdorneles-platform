import "@mantine/core/styles.css";
import "./globals.css";

import { COLOR_SCHEME_STORAGE_KEY } from "@cdorneles/theme";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { OrgBranding } from "@cdorneles/ui/tenant";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cdorneles Customer",
  description: "End-customer experience.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript
          defaultColorScheme="auto"
          localStorageKey={COLOR_SCHEME_STORAGE_KEY}
        />
      </head>
      <body>
        <OrgBranding />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

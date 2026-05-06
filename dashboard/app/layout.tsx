import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SF Dashboard",
  description: "Salesforce AI Dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, settings] = await Promise.all([
    getSession(),
    Promise.resolve(getSettings()),
  ]);

  const cssVars = [
    `:root {`,
    `  --color-primary: ${settings.primaryColor};`,
    `  --color-secondary: ${settings.secondaryColor};`,
    `  --color-accent: ${settings.accentColor};`,
    `  --border-radius: ${settings.borderRadius}px;`,
    `  --font-heading: '${settings.headingFont}', ui-sans-serif, system-ui, sans-serif;`,
    `  --font-body: '${settings.bodyFont}', ui-sans-serif, system-ui, sans-serif;`,
    `}`,
  ].join("\n");

  // Deduplicated Google Fonts URLs
  const fontUrls = [...new Set([settings.headingFontUrl, settings.bodyFontUrl].filter((u): u is string => !!u))];

  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: cssVars }} />
        {fontUrls.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body className={`${inter.className} antialiased`}>
        <AppShell
          displayName={session.displayName}
          instanceUrl={session.instanceUrl}
          appName={settings.appName}
          logoBase64={settings.logoBase64}
          sidebarStyle={settings.sidebarStyle}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

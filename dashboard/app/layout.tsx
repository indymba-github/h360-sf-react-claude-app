import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { brandAccentForDarkMode, brandForegroundOn, deriveAccentTextColor, inkDeepFromInk } from "@/lib/brandColors";

const inter = Inter({ subsets: ["latin"], variable: "--loaded-inter" });

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--loaded-source-serif-4",
});

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

  const legacyInk = settings.inkColor ?? "#1B1F2A";
  const paper     = settings.paperColor    ?? "#F4F1EA";
  const text      = settings.textColor     ?? legacyInk;
  const headerBg  = settings.headerBgColor ?? legacyInk;
  const headerFg  = settings.headerFgColor ?? paper;

  // Accent vars go in :root — they apply in both themes (client-side applyBrandTokens
  // adapts them for dark mode). Surface/header vars are scoped to [data-theme="light"]
  // so they never override [data-theme="dark"] in globals.css.
  const accentVars = [
    `--color-accent: ${settings.accentColor};`,
    `--color-accent-on-dark: ${brandAccentForDarkMode(settings.accentColor)};`,
    `--color-accent-foreground: ${brandForegroundOn(settings.accentColor)};`,
    `--color-accent-text: ${deriveAccentTextColor(settings.accentColor, paper)};`,
  ].join("\n  ");

  const lightVars = [
    `--color-paper: ${paper};`,
    `--color-text: ${text};`,
    `--color-ink: ${text};`,
    `--color-ink-deep: ${inkDeepFromInk(text)};`,
    `--color-header-bg: ${headerBg};`,
    `--color-header-fg: ${headerFg};`,
  ].join("\n  ");

  const cssVars = `:root {\n  ${accentVars}\n}\n[data-theme="light"] {\n  ${lightVars}\n}`;

  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif4.variable}`}>
      <head>
        {cssVars && <style dangerouslySetInnerHTML={{ __html: cssVars }} />}
      </head>
      <body className="antialiased">
        <meta name="aiqa-project" content="sf-mcp-dashboard" />
        <Script src="http://127.0.0.1:8765/aiqa-widget.js" strategy="afterInteractive" />
        <ThemeProvider />
        <AppShell
          displayName={session.displayName}
          instanceUrl={session.instanceUrl}
          appName={settings.appName}
          logoBase64={settings.logoBase64}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

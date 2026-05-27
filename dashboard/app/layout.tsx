import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import ThemeProvider from "@/components/ThemeProvider";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { brandAccentForDarkMode, brandForegroundOn } from "@/lib/brandColors";

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

  const overrides = [
    `--color-accent: ${settings.accentColor};`,
    `--color-accent-on-dark: ${brandAccentForDarkMode(settings.accentColor)};`,
    `--color-accent-foreground: ${brandForegroundOn(settings.accentColor)};`,
  ].join("\n  ");

  const cssVars = `:root {\n  ${overrides}\n}`;

  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif4.variable}`}>
      <head>
        {cssVars && <style dangerouslySetInnerHTML={{ __html: cssVars }} />}
      </head>
      <body className="antialiased">
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

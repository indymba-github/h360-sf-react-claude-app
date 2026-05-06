import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";

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
  // Read session once at the layout level so Sidebar gets user info
  // without a round-trip from each individual page.
  const session = await getSession();

  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <AppShell
          displayName={session.displayName}
          instanceUrl={session.instanceUrl}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Spotlight — Pièces choisies", template: "%s · Spotlight" },
  description: "Spotlight, vêtements et accessoires de seconde main.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>
        <a className="skip" href="#main">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}

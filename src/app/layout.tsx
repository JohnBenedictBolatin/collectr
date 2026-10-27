import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Collectr — Your collection. In its place.", template: "%s · Collectr" },
  description: "A personal home for the things you collect. Organize your library and keep every item close to its place.",
  applicationName: "Collectr",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

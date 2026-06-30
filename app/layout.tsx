import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal WebGIS - AMBIUM Digital",
  description: "Plataforma WebGIS multi-cliente para análises ambientais e territoriais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}

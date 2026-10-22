import type { Metadata, Viewport } from "next";
import "./globals.css";
import { assetPath } from "@/lib/paths";

export const metadata: Metadata = {
  applicationName: "KernelHub",
  title: "KernelHub — Sua evolução, todos os dias",
  description:
    "Um espaço pessoal para cuidar do corpo, construir projetos e continuar aprendendo. Protótipo local com dados demonstrativos.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KernelHub",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: assetPath("/icon.svg"),
    apple: assetPath("/icons/apple-touch-icon.png"),
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

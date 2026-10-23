import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./shell.css";
import "./pulse.css";
import "./skincare.css";
import "./skincare-history.css";
import { assetPath } from "@/lib/paths";
import packageInfo from "../package.json";

export const metadata: Metadata = {
  applicationName: "KernelHub",
  title: "KernelHub — Sua evolução, todos os dias",
  description:
    "Um espaço pessoal para cuidar do corpo, construir projetos e continuar aprendendo. Saúde importada, atividade pública do GitHub e foco acompanhado em um espaço local e privado.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "KernelHub",
  },
  formatDetection: { telephone: false },
  other: { "application-version": packageInfo.version },
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

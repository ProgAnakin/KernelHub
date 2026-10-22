import type { MetadataRoute } from "next";
import { assetPath } from "@/lib/paths";
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: assetPath("/"),
    name: "KernelHub — Seu sistema pessoal",
    short_name: "KernelHub",
    description:
      "Sua evolução, todos os dias. Corpo, rotina e projetos em um só lugar.",
    lang: "pt-BR",
    start_url: assetPath("/"),
    scope: assetPath("/"),
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait-primary",
    icons: [
      {
        src: assetPath("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: assetPath("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: assetPath("/icons/icon-maskable.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

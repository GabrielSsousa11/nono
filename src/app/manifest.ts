import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Charlene Gonçalves Odontologia",
    short_name: "CG Odontologia",
    description: "Portal do paciente e site da clínica Charlene Gonçalves Odontologia.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/?origem=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f4ed",
    theme_color: "#f7f4ed",
    categories: ["health", "medical"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Área do paciente", url: "/entrar", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Agendar", url: "/#agendamento", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}

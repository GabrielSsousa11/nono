import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { getSiteContent } from "@/lib/content";
import { siteUrl } from "@/lib/env";
import "./globals.css";

// Fontes auto-hospedadas no build (sem requisições ao Google em tempo de execução).
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const { content } = getSiteContent();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${content.clinicName} — Beyond the Smile`,
    template: `%s · ${content.clinicName}`,
  },
  description: `${content.tagline} Odontologia com escuta, precisão e acompanhamento contínuo.`,
  applicationName: content.clinicName,
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: "CG Odontologia", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: content.clinicName,
    title: content.clinicName,
    description: content.tagline,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ed",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${manrope.variable} antialiased`}>
      <body className="min-h-dvh">
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

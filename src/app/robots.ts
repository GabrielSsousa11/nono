import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  // Ambiente de apresentação/homologação nunca é indexado por buscadores.
  if (process.env.CG_DEPLOY_ENV === "preview") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/portal", "/studio", "/entrar", "/auth", "/continuar", "/offline"] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

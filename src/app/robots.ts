import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/portal", "/studio", "/entrar", "/auth", "/continuar", "/offline"] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

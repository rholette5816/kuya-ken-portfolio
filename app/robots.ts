import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/system/dashboard", "/system/login"]
    },
    sitemap: "https://www.kradigital.site/sitemap.xml"
  };
}

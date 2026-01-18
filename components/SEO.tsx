import { siteConfig } from "@/data/site";
import { Metadata } from "next";

export const defaultSEO: Metadata = {
  title: `${siteConfig.name} – ${siteConfig.tagline}`,
  description: siteConfig.description,
  openGraph: {
    title: `${siteConfig.name} – ${siteConfig.tagline}`,
    description: siteConfig.description,
    url: "https://www.yonodmc.com",
    siteName: siteConfig.name,
    locale: "en_IN",
    type: "website",
  },
};

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fresh Cup Juice House",
    short_name: "Fresh Cup",
    description: "Cold-pressed juice, smoothies, and healthy food — Merkato, Addis Ababa.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf6ef",
    theme_color: "#1b4332",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

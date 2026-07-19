import { ToastProvider } from "@fresh-cup/ui";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { Fraunces, Inter, Noto_Sans_Ethiopic } from "next/font/google";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { SkipLink } from "@/components/SkipLink";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/lib/auth-context";
import { BranchProvider } from "@/lib/branch-context";
import { CartProvider } from "@/lib/cart-context";
import { FavoritesProvider } from "@/lib/favorites-context";
import { QueryProvider } from "@/lib/query-provider";
import { DineInTableProvider } from "@/lib/table-context";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const notoEthiopic = Noto_Sans_Ethiopic({
  variable: "--font-noto-ethiopic",
  subsets: ["ethiopic"],
});

export const metadata: Metadata = {
  title: "Fresh Cup Juice House",
  description: "Premium fresh juice and healthy food, Merkato, Addis Ababa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Fresh Cup",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#17140f" },
  ],
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${fraunces.variable} ${notoEthiopic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-surface text-fg">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <QueryProvider>
              <AuthProvider>
                <BranchProvider>
                  <DineInTableProvider>
                    <CartProvider>
                      <FavoritesProvider>
                        <ToastProvider>
                          <ServiceWorkerRegistrar />
                          <SkipLink />
                          <OfflineBanner />
                          <Header />
                          <main id="main-content" className="flex flex-1 flex-col">
                            {children}
                          </main>
                          <Footer />
                        </ToastProvider>
                      </FavoritesProvider>
                    </CartProvider>
                  </DineInTableProvider>
                </BranchProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

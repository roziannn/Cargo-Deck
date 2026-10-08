import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_LANG, LANG_COOKIE, isLang } from "@/lib/i18n/locale";
import { I18nProvider } from "@/lib/i18n/provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Logistic Shipping System",
  description: "Logistic Shipping System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(saved) ? saved : DEFAULT_LANG;

  return (
    <html lang={lang} className={inter.variable} suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ThemeProvider attribute="class" enableSystem={false}>
          <I18nProvider initialLang={lang}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

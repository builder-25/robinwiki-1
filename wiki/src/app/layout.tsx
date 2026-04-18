import type { Metadata } from "next";
import { Source_Serif_4, Inter, IBM_Plex_Sans, Geist } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/providers/QueryProvider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif-4",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Robin Wiki",
  description: "Your personal knowledge base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={cn(
        "h-full",
        sourceSerif.variable,
        inter.variable,
        ibmPlexSans.variable,
        "font-sans",
        geist.variable,
      )}
      suppressHydrationWarning
    >
      <body className="h-full">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

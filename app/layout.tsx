import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

// Start scheduled tasks, but only on the server
// NOTE: Node-cron scheduling has been removed in favor of Vercel cron

export const metadata: Metadata = {
  title: "MACY - Market Analysis & Context Enhancement Intelligence",
  description:
    "AI-powered idea validation for businesses. Analyze market signals and validate your next big idea.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "MACY - Market Intelligence",
    description:
      "AI-powered idea validation for businesses. Analyze market signals and validate your next big idea.",
    url: "https://getmacy.com",
    siteName: "MACY",
    images: [
      {
        url: "https://getmacy.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "MACY - Market Analysis & Context Enhancement Intelligence",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MACY - Market Intelligence",
    description:
      "AI-powered idea validation for businesses. Analyze market signals and validate your next big idea.",
    images: ["https://getmacy.com/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Toaster richColors position="top-right" />
        <Analytics />
      </body>
    </html>
  );
}

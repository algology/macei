import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MACEI - Market Analysis & Context Enhancement Intelligence",
  description:
    "AI-powered idea validation for businesses. Analyze market signals and validate your next big idea.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

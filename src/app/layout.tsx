import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snaplist",
  description: "AI-powered second-hand listing generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}

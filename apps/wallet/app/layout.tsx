import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/contexts/auth-context";
import { DevnetBanner } from "@/components/atoms/devnet-banner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Sui Wallet - zkLogin",
  description: "A Sui wallet using zkLogin for secure, private authentication",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          <DevnetBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

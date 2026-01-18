import WhatsAppButton from "@/components/WhatsAppButton";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Yono DMC – Trusted Travel Agency in India",
    template: "%s | Yono DMC",
  },
  description:
    "Yono DMC is a trusted travel agency in India offering customized domestic & international holiday packages including Dubai, Bali, Singapore, Malaysia and more.",
  keywords: [
    "travel agency in India",
    "holiday packages",
    "Dubai tour packages",
    "Bali tour packages",
    "Singapore tour packages",
    "Malaysia tour packages",
    "Yono DMC",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Header />
        <main className="max-w-7xl mx-auto px-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

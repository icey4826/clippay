import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "ClipPay",
  description: "Photo-graded damage claims settled with a partial PayPal refund.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 sm:px-6">
          <header className="flex items-center justify-between py-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ClipPay
            </Link>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              PayPal sandbox: no real money
            </span>
          </header>
          <main className="flex-1 pb-16">{children}</main>
        </div>
      </body>
    </html>
  );
}

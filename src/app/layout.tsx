import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/ui";
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
  description: "Photo-graded damage claims settled with a partial PayPal refund, no returns.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6">
          <header className="flex items-center justify-between gap-4 py-5">
            <Link href="/" aria-label="ClipPay home">
              <Logo className="text-lg" />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-full px-3 py-1.5 text-muted hover:bg-ink/5 hover:text-ink">
                Shop
              </Link>
              <Link href="/merchant" className="rounded-full px-3 py-1.5 text-muted hover:bg-ink/5 hover:text-ink">
                Merchant
              </Link>
              <span className="ml-2 hidden rounded-full bg-warn-soft px-3 py-1 text-xs font-medium text-warn sm:inline">
                Sandbox · no real money
              </span>
            </nav>
          </header>
          <main className="flex-1 pb-20">{children}</main>
          <footer className="border-t border-line py-6 text-xs text-faint">
            ClipPay · PayPal AI hackathon demo · Gemini grades the photo, a rules engine sets the price, PayPal pays it.
          </footer>
        </div>
      </body>
    </html>
  );
}

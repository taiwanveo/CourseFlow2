import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

const notoSansTc = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CourseFlow — 教學影片生成平台",
  description: "從教學文件自動產生教學影片",
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/x-icon" }],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "256x256", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW" className={`${dmSans.variable} ${notoSansTc.variable}`}>
      <body className="min-h-screen antialiased" style={{ fontFamily: "var(--font-sans)" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

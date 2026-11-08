import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ARKAN CO. – RENT A CAR",
  description: "ARKAN Car Rental Management",
  manifest: "/manifest.json"
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl"><body>{children}</body></html>;
}
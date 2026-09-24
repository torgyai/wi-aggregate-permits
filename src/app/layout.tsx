import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stratex Aggregate",
  description: "Wisconsin pit & quarry permitting — prospecting, outreach, closing and delivery on autopilot",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

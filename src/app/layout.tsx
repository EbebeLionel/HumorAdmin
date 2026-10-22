import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humor Project Admin",
  description: "Admin area for The Humor Project",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

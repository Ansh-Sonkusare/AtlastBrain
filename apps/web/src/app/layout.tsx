import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Second Brain", template: "%s | Second Brain" },
  description: "Save a page and see only what is new to you, checked against everything you have read.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

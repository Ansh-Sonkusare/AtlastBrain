import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { APP_NAME } from "./brand";
import { clerkAppearance } from "./clerk-appearance";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: "Save a page and see only what is new to you, checked against everything you have read.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider appearance={clerkAppearance} signInUrl="/sign-in" signUpUrl="/signup" afterSignOutUrl="/">
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

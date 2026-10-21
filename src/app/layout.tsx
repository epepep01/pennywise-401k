import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pennywise | 401(k) Contribution Planner",
  description:
    "Plan a 401(k) contribution rate around your remaining paychecks, raises, bonuses, and annual goal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

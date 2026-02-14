import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jon's Coffee | NYC Coffee Shop",
  description:
    "AI-powered ordering for NYC's favorite coffee shop. Order by voice or text!",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}

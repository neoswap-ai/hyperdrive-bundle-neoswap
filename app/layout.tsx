import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SolanaConnection from "./_components/solanaConnection";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hypderdrive Bundle Neoswap",
  description: "Bootstrap your game play",
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SolanaConnection>{children}</SolanaConnection>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/navbar";

export const metadata: Metadata = {
  title: "Inventory Manager",
  description: "Manage products, sales, purchases, suppliers and platforms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <div className="min-h-screen md:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
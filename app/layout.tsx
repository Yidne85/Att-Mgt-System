import "./globals.css";
import type { Metadata } from "next";
import AppHeader from "../components/AppHeader";

export const metadata: Metadata = {
  title: "የአባላት ክትትል",
  description: "ይህ የሰንበት ት/ቤቱ የመዝሙር ክፍል የአባላት ቀሪ መቆጣጠሪያ ሲስተም ነው",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
          <AppHeader />
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
          <footer className="py-10 text-center text-xs text-gray-500">የመንበረ ጸባዖት ቅ/ሥላሴ ካቴድራል ሰንበት ት/ቤት</footer>
        </div>
      </body>
    </html>
  );
}

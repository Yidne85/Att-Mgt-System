import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Attendance QR",
  description: "Simple attendance management with QR check-in",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-10 bg-white border-b">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="font-semibold">Attendance QR</div>
              <nav className="text-sm flex gap-4">
                <a href="/app">Dashboard</a>
                <a href="/checkin">Check-in</a>
                <a href="/logout">Logout</a>
              </nav>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
          <footer className="py-10 text-center text-xs text-gray-500">
            Built with Next.js + Supabase (free tiers)
          </footer>
        </div>
      </body>
    </html>
  );
}

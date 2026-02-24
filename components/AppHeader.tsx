"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getMyProfile, UserProfile } from "../lib/profile";

export default function AppHeader() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const p = await getMyProfile();
        setProfile(p);
      }
      setReady(true);
    })();
  }, []);

  if (isAuthPage) return null;
  if (!ready) return null;

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          Attendance QR
        </Link>

        {profile ? (
          <nav className="text-sm flex gap-4 items-center">
            <Link href="/app" className="hover:underline">Dashboard</Link>
            <Link href="/checkin" className="hover:underline">Check-in</Link>
            <Link href="/app/events" className="hover:underline">Events</Link>
            <Link href="/app/reports" className="hover:underline">Reports</Link>
            {profile.role === "admin" ? (
              <>
                <Link href="/app/classes" className="hover:underline">Classes</Link>
                <Link href="/app/types" className="hover:underline">Types</Link>
                <Link href="/app/users" className="hover:underline">Users</Link>
              </>
            ) : null}
            <Link href="/logout" className="hover:underline text-gray-600">Logout</Link>
          </nav>
        ) : (
          <nav className="text-sm flex gap-4 items-center">
            <Link href="/login" className="hover:underline">Log in</Link>
          </nav>
        )}
      </div>
    </header>
  );
}

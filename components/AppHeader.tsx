"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getMyProfile, UserProfile } from "../lib/profile";

export default function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data.session;
      setHasSession(!!session);

      if (session) {
        try {
          const p = await getMyProfile();
          if (mounted) setProfile(p);
        } catch {
          // Profile may be missing or blocked by RLS; still treat user as logged in.
          if (mounted) setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (!session) setProfile(null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (isAuthPage) return null;
  if (!ready) return null;

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand should always go to landing page, not sign out */}
        <Link href="/" className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-lg">
  <span className="font-bold">
         ጸባዖት የቀሪ መቆጣጠሪያ
        </Link>

        {hasSession ? (
          <nav className="text-sm flex gap-4 items-center">
            <Link href="/app" className="hover:underline">Dashboard</Link>
            <Link href="/checkin" className="hover:underline">Check-in</Link>
            <Link href="/app/events" className="hover:underline">Events</Link>
            <Link href="/app/reports" className="hover:underline">Reports</Link>

            {/* Admin-only links if profile is available */}
            {profile?.role === "admin" ? (
              <>
                <Link href="/app/classes" className="hover:underline">Classes</Link>
                <Link href="/app/types" className="hover:underline">Types</Link>
                <Link href="/app/users" className="hover:underline">Users</Link>
              </>
            ) : null}

            <button onClick={logout} className="hover:underline text-gray-600">
              Logout
            </button>
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

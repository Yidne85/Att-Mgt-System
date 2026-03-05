"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AppHeader() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setLoggedIn(!!data.session);
      setReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!ready) return null;

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand ALWAYS goes to landing page */}
        <Link
          href="/"
          className="flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-lg shadow-sm hover:bg-brand-dark transition"
        >
          <span className="font-bold">ጸባዖት አቴንዳንስ</span>
        </Link>

        <nav className="flex items-center gap-2">
          {loggedIn ? (
            <>
              <Link
                href="/app"
                className="px-3 py-2 rounded-lg bg-brand-light text-white hover:bg-brand transition"
              >
                Dashboard
              </Link>
      
              <button
                onClick={logout}
                className="px-3 py-2 rounded-lg bg-brand text-white hover:bg-brand-dark transition shadow-sm"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-3 py-2 rounded-lg bg-brand text-white hover:bg-brand-dark transition shadow-sm"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

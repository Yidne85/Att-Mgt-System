"use client";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function Logout() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.push("/");
    })();
  }, [router]);

  return <div className="text-sm text-gray-600">Signing out…</div>;
}

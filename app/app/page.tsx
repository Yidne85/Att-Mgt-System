"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { Card } from "../../components/ui";
import { requireProfile, UserProfile } from "../../lib/profile";

type Org = { id: string; name: string };
type ClassRow = { id: string; name: string };

export default function Dashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  void (async () => {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/login";
        return;
      }

      const p = await requireProfile();
      setProfile(p);

      const { data: orgRow, error: orgErr } = await supabase
        .from("orgs")
        .select("*")
        .eq("id", p.org_id)
        .maybeSingle();

      if (orgErr) throw orgErr;
      if (!orgRow) throw new Error("Org not found for this user.");

      setOrg(orgRow as any);

      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("id,name")
        .eq("org_id", p.org_id)
        .order("name");

      if (clsErr) throw clsErr;
      setClasses((cls as any) ?? []);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  })();
}, []);
  return (
    <div className="grid gap-4">
      <Card title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <Link className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium shadow-sm" href="/checkin">
            Check in
          </Link>

          <Link className="px-3 py-2 rounded-xl border bg-white text-sm font-medium shadow-sm" href="/app/events">
            Events
          </Link>

          <Link className="px-3 py-2 rounded-xl border bg-white text-sm font-medium shadow-sm" href="/app/reports">
            Reports & export
          </Link>

          {profile?.role === "admin" ? (
            <>
              <Link className="px-3 py-2 rounded-xl border bg-white text-sm font-medium shadow-sm" href="/app/classes">
                Classes & students
              </Link>
              <Link className="px-3 py-2 rounded-xl border bg-white text-sm font-medium shadow-sm" href="/app/types">
                Attendance types
              </Link>
              <Link className="px-3 py-2 rounded-xl border bg-white text-sm font-medium shadow-sm" href="/app/users">
                Users
              </Link>
              <Link className="px-3 py-2 rounded-xl border bg-white text-sm font-medium shadow-sm" href="/register">
                Create Admin
              </Link>
            </>
          ) : null}
        </div>
      </Card>

      <Card title="Overview">
        {loading ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : (
          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-gray-600">Organization:</span> <span className="font-medium">{org?.name}</span>
            </div>
            <div>
              <span className="text-gray-600">Role:</span> <span className="font-medium">{profile?.role}</span>
            </div>
            <div>
              <span className="text-gray-600">Classes:</span> <span className="font-medium">{classes.length}</span>
            </div>
            <div className="text-gray-600">
              Use <span className="font-mono">Check in</span> on your phone to scan QR codes.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

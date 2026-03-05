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
    (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/login";
        return;
      }
      const p = await requireProfile();
      setProfile(p);

      const { data: orgRow } = await supabase.from("orgs").select("*").eq("id", p.org_id).single();
      setOrg(orgRow as any);

      const { data: cls } = await supabase.from("classes").select("id,name").eq("org_id", p.org_id).order("name");
      setClasses((cls as any) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="grid gap-4">
      <Card title="Quick actions">
        <div className="flex flex-wrap items-center gap-4">
          <Link className="bg-brand text-white rounded-xl p-4 shadow-sm hover:bg-brand-dark transition" href="/checkin">
            Check in
          </Link>

          <Link className="text-brand font-semibold hover:text-brand-dark transition" href="/app/events">
            Events
          </Link>

          <Link className="text-brand font-semibold hover:text-brand-dark transition" href="/app/reports">
            Reports & export
          </Link>

          {profile?.role === "admin" ? (
            <>
              <Link className="text-brand font-semibold hover:text-brand-dark transition" href="/app/classes">
                Classes & students
              </Link>
              <Link className="text-brand font-semibold hover:text-brand-dark transition" href="/app/types">
                Attendance types
              </Link>
              <Link className="text-brand font-semibold hover:text-brand-dark transition" href="/app/users">
                Users
              </Link>
              <Link className="text-brand font-semibold hover:text-brand-dark transition" href="/register">
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button, Card } from "../../components/ui";
import Link from "next/link";

type Org = { id: string; name: string };
type ClassRow = { id: string; name: string };

export default function Dashboard() {
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
      const userId = sess.session.user.id;

      const { data: orgRow } = await supabase.from("orgs").select("*").eq("owner_user_id", userId).single();
      setOrg(orgRow);

      if (orgRow?.id) {
        const { data: cls } = await supabase.from("classes").select("*").eq("org_id", orgRow.id).order("name");
        setClasses(cls ?? []);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="grid gap-4">
      <Card title="Quick actions">
        <div className="flex flex-wrap gap-2">
          <Link className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium" href="/app/classes">
            Manage classes & students
          </Link>
          <Link className="px-3 py-2 rounded-lg border text-sm font-medium" href="/app/events">
            Create class events
          </Link>
          <Link className="px-3 py-2 rounded-lg border text-sm font-medium" href="/app/types">
            Attendance types & points
          </Link>
          <Link className="px-3 py-2 rounded-lg border text-sm font-medium" href="/app/reports">
            Reports & export
          </Link>
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
              <span className="text-gray-600">Classes:</span> <span className="font-medium">{classes.length}</span>
            </div>
            <div className="text-gray-600">
              Use <span className="font-mono">Check-in</span> (top menu) on your phone to scan QR codes.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

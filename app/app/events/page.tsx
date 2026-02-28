"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { requireProfile, UserProfile } from "../../../lib/profile";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";

type Org = { id: string };
type ClassRow = { id: string; name: string };
type EventRow = { id: string; class_id: string; title: string; starts_at: string; ends_at: string };

export default function EventsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("Class session");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const className = useMemo(() => classes.find(c => c.id === classId)?.name ?? "", [classes, classId]);

  async function load() async function load() {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) {
    window.location.href = "/login";
    return;
  }

  const userId = sess.session.user.id;

  // Get org
  const { data: orgRow } = await supabase
    .from("orgs")
    .select("*")
    .eq("owner_user_id", userId)
    .single();

  setOrg(orgRow);

  // Get classes in this org
  const { data: cls } = await supabase
    .from("classes")
    .select("*")
    .eq("org_id", orgRow.id)
    .order("name");

  setClasses(cls ?? []);

  // ✅ Load events using class_id instead of org_id
  const classIds = (cls ?? []).map((c) => c.id);

  if (classIds.length > 0) {
    const { data: ev } = await supabase
      .from("class_events")
      .select("*")
      .in("class_id", classIds)
      .order("starts_at", { ascending: false });

    setEvents(ev ?? []);
  } else {
    setEvents([]);
  }
}

  useEffect(() => { load(); }, []);

  async function createEvent() {
    if (!org?.id || !classId || !startsAt) return;
    const { error } = await supabase.from("class_events").insert({
      class_id: classId,
      title: title.trim() || "Class session",
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
    });
    if (error) { setErr(error.message); return; }
    setMsg('Event created.');
    setTitle("Class session");
    setStartsAt("");
    setEndsAt("");
    await load();
  }

  return (
    <div className="grid gap-4">
      <Card title="Create class event">
        {msg ? <div className="mb-2 text-sm text-green-700">{msg}</div> : null}
        {err ? <div className="mb-2 text-sm text-red-700">{err}</div> : null}
        <div className="grid gap-2 max-w-2xl">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Class</label>
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">-- choose --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Start date & time</label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              <Hint>Used to decide late vs present.</Hint>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">End date & time</label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              <Hint>After this time, check-in is closed.</Hint>
            </div>
          </div>
          <Button onClick={createEvent} disabled={!classId || !startsAt || !endsAt}>Create event</Button>
        </div>
      </Card>

      <Card title="Events">
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2">Class</th>
                <th className="text-left p-2">Starts</th>
                <th className="text-left p-2">Ends</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-t">
                  <td className="p-2">{ev.title}</td>
                  <td className="p-2">{classes.find(c => c.id === ev.class_id)?.name ?? "—"}</td>
                  <td className="p-2">{new Date(ev.starts_at).toLocaleString()}</td>
                  <td className="p-2">{new Date(ev.ends_at).toLocaleString()}</td>
                </tr>
              ))}
              {events.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={4}>No events yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

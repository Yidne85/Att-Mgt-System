"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "../../lib/supabase";
import { requireProfile } from "../../lib/profile";
import { Button, Card, Select, Hint } from "../../components/ui";

type Org = { id: string };
type ClassRow = { id: string; name: string };
type EventRow = { id: string; title: string; starts_at: string; ends_at: string; class_id: string };
type TypeRow = { id: string; name: string; points: number; start_minute: number; end_minute: number | null };

export default function CheckinPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [eventId, setEventId] = useState("");
  const [lastMsg, setLastMsg] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId]);

  const sortedTypes = useMemo(() => {
    return [...types].sort((a, b) => (a.start_minute - b.start_minute) || a.name.localeCompare(b.name));
  }, [types]);

  // ✅ FIXED: correct braces + uses profile.org_id (works for admin/support)
  useEffect(() => {
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        window.location.href = "/login";
        return;
      }

      const p = await requireProfile();
      if (!p?.org_id) {
        alert("User profile not found.");
        return;
      }

      const { data: orgRow, error: orgErr } = await supabase
        .from("orgs")
        .select("id")
        .eq("id", p.org_id)
        .single();

      if (orgErr || !orgRow) {
        alert(orgErr?.message ?? "Org not found");
        return;
      }

      setOrg(orgRow);

      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("id,name")
        .eq("org_id", orgRow.id)
        .order("name");

      if (clsErr) {
        alert(clsErr.message);
        setClasses([]);
        setEvents([]);
        setTypes([]);
        return;
      }

      setClasses((cls ?? []) as ClassRow[]);

      // ✅ Events by class_id list (NO class_events.org_id)
      const classIds = (cls ?? []).map((c: ClassRow) => c.id);
      if (classIds.length > 0) {
        const { data: ev, error: evErr } = await supabase
          .from("class_events")
          .select("id,title,starts_at,ends_at,class_id")
          .in("class_id", classIds)
          .order("starts_at", { ascending: false });

        if (evErr) alert(evErr.message);
        setEvents((ev ?? []) as EventRow[]);
      } else {
        setEvents([]);
      }

      const { data: t, error: tErr } = await supabase
        .from("attendance_types")
        .select("id,name,points,start_minute,end_minute")
        .eq("org_id", orgRow.id);

      if (tErr) alert(tErr.message);
      setTypes((t ?? []) as TypeRow[]);
    })();
  }, []);

  // Load summary rows
  useEffect(() => {
    if (!eventId) {
      setRows([]);
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("attendance_records_view")
        .select("*")
        .eq("event_id", eventId)
        .order("checked_in_at", { ascending: true });

      if (error) {
        console.error(error);
        setLastMsg(error.message);
        setRows([]);
        return;
      }

      setRows(data ?? []);
    })();
  }, [eventId]);

  function decideStatus(eventStartsAtIso: string, checkedInIso: string) {
    if (sortedTypes.length === 0) return "present";

    const start = new Date(eventStartsAtIso).getTime();
    const now = new Date(checkedInIso).getTime();
    const diffMin = Math.max(0, Math.floor((now - start) / 60000));

    const match = sortedTypes.find(
      (t) => diffMin >= t.start_minute && (t.end_minute === null || diffMin < t.end_minute)
    );

    return (match?.name ?? sortedTypes[0].name).toLowerCase();
  }

  async function startScan() {
    if (!eventId) {
      alert("Select an event first");
      return;
    }
    if (!org?.id) {
      alert("Org not loaded");
      return;
    }

    const ev = events.find((x) => x.id === eventId);
    if (!ev) {
      alert("Event not found");
      return;
    }

    // ✅ Event closed check
    if (new Date().getTime() > new Date(ev.ends_at).getTime()) {
      setLastMsg("Event Closed");
      return;
    }

    setLastMsg("");
    const elId = "reader";
    const scanner = new Html5Qrcode(elId);
    scannerRef.current = scanner;
    setScanning(true);

    const config = { fps: 10, qrbox: { width: 250, height: 250 } as any };

    await scanner.start(
      { facingMode: "environment" },
      config,
      async (decodedText: string) => {
        try {
          // If event ended while scanning
          if (new Date().getTime() > new Date(ev.ends_at).getTime()) {
            setLastMsg("Event Closed");
            return;
          }

          const payload = JSON.parse(decodedText);
          const student_uid = payload?.student_uid;
          if (!student_uid) throw new Error("Invalid QR payload");

          // ✅ NEW schema: student is org-level
          const { data: st, error: stErr } = await supabase
            .from("students")
            .select("id,full_name,student_uid")
            .eq("student_uid", student_uid)
            .eq("org_id", org.id)
            .single();

          if (stErr || !st) {
            setLastMsg("Student not found.");
            return;
          }

          // ✅ NEW schema: confirm enrollment in this event's class via class_students
          const { data: enr, error: enrErr } = await supabase
            .from("class_students")
            .select("student_id")
            .eq("class_id", ev.class_id)
            .eq("student_id", st.id)
            .limit(1);

          if (enrErr) throw new Error(enrErr.message);
          if (!enr || enr.length === 0) {
            setLastMsg("Student is not enrolled in this class.");
            return;
          }

          const now = new Date();
          const status = decideStatus(ev.starts_at, now.toISOString());

          const { error } = await supabase.from("attendance").upsert(
            {
              event_id: eventId,
              student_id: st.id,
              checked_in_at: now.toISOString(),
              status,
            },
            { onConflict: "event_id,student_id" }
          );

          if (error) throw error;

          setLastMsg(`${st.full_name} checked in as ${status.toUpperCase()} at ${now.toLocaleTimeString()}`);

          const { data, error: rErr } = await supabase
            .from("attendance_records_view")
            .select("*")
            .eq("event_id", eventId)
            .order("checked_in_at", { ascending: true });

          if (rErr) {
            console.error(rErr);
            setLastMsg(rErr.message);
            return;
          }

          setRows(data ?? []);
        } catch (e: any) {
          setLastMsg(e?.message ?? "Scan error");
        }
      },
      () => {}
    );
  }

  async function stopScan() {
    const s = scannerRef.current;
    if (s) {
      try {
        await s.stop();
      } catch {}
      try {
        s.clear();
      } catch {}
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const classForEvent = useMemo(() => {
    if (!event) return "";
    return classes.find((c) => c.id === event.class_id)?.name ?? "";
  }, [event, classes]);

  return (
    <div className="grid gap-4">
      <Card title="QR check-in">
        <div className="grid gap-3 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Event</label>
              <Select
                value={eventId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setEventId(e.target.value);
                  setLastMsg("");
                }}
              >
                <option value="">-- choose --</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {new Date(e.starts_at).toLocaleString()} — {e.title}
                  </option>
                ))}
              </Select>
              {event ? (
                <div className="text-xs text-gray-600 mt-1">
                  Class: <b>{classForEvent}</b>
                </div>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium">Scanner</label>
              <div className="flex gap-2">
                {!scanning ? (
                  <Button onClick={startScan} disabled={!eventId}>
                    Start
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={stopScan}>
                    Stop
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Hint>
            The app decides the attendance type from your configured time windows (see <b>Attendance Types</b>). Entry
            time is recorded automatically.
          </Hint>

          <div id="reader" className="w-full max-w-md border rounded-xl overflow-hidden bg-black/5" />

          {lastMsg ? <div className="text-sm p-3 rounded-lg border bg-gray-50">{lastMsg}</div> : null}
        </div>
      </Card>

      <Card title="Attendance summary for selected event">
        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Student</th>
                <th className="text-left p-2">Attendance type</th>
                <th className="text-left p-2">Entry time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.attendance_id} className="border-t">
                  <td className="p-2">{r.full_name}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{new Date(r.checked_in_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="p-2 text-gray-600" colSpan={3}>
                    No check-ins yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

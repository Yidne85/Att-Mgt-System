"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { requireProfile } from "../../../lib/profile";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ClassRow = { id: string; name: string };
type EventRow = { id: string; title: string; starts_at: string; ends_at: string; class_id: string };
type TypeRow = { id: string; name: string; points: number };

type DetailRow = {
  student_name: string;
  event_title: string;
  status: string;
  points: number;
  checked_in_at: string;
};

type PointsRow = {
  full_name: string;
  total_events: number;
  points_sum: number;
  date_range: string;
};

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export default function ReportsPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);

  // filters (only class is required)
  const [classId, setClassId] = useState("");
  const [eventId, setEventId] = useState("");
  const [fromDate, setFromDate] = useState(""); // optional
  const [toDate, setToDate] = useState("");     // optional
  const [status, setStatus] = useState("");     // optional
  const [studentName, setStudentName] = useState(""); // optional

  const [details, setDetails] = useState<DetailRow[]>([]);
  const [pointsRows, setPointsRows] = useState<PointsRow[]>([]);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const typeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of types) m.set(t.name.toLowerCase(), Number(t.points ?? 0));
    return m;
  }, [types]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { window.location.href = "/login"; return; }

      const p = await requireProfile();

      const { data: cls, error: clsErr } = await supabase
        .from("classes")
        .select("id,name")
        .eq("org_id", p.org_id)
        .order("name");

      if (clsErr) { alert(clsErr.message); return; }
      setClasses((cls as ClassRow[]) ?? []);

      const { data: t, error: tErr } = await supabase
        .from("attendance_types")
        .select("id,name,points")
        .eq("org_id", p.org_id)
        .order("start_minute", { ascending: true });

      if (tErr) { alert(tErr.message); return; }
      setTypes((t as TypeRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Load events when class changes
  useEffect(() => {
    if (!classId) { setEvents([]); setEventId(""); return; }
    void (async () => {
      const { data: ev, error } = await supabase
        .from("class_events")
        .select("id,title,starts_at,ends_at,class_id")
        .eq("class_id", classId)
        .order("starts_at", { ascending: false });

      if (error) { alert(error.message); return; }
      setEvents((ev as EventRow[]) ?? []);
    })();
  }, [classId]);

  function dateRangeLabel() {
    const from = fromDate ? new Date(fromDate).toLocaleDateString() : "All time";
    const to = toDate ? new Date(toDate).toLocaleDateString() : "Now";
    return `${from} → ${to}`;
  }

  async function runReports() {
    if (!classId) { alert("Select a class first"); return; }
    setMsg("");
    setDetails([]);
    setPointsRows([]);

    // 1) get event ids for the class (and optional event/date filters)
    let evQuery = supabase
      .from("class_events")
      .select("id,title,starts_at")
      .eq("class_id", classId);

    if (eventId) evQuery = evQuery.eq("id", eventId);

    if (fromDate) evQuery = evQuery.gte("starts_at", new Date(fromDate).toISOString());
    if (toDate) evQuery = evQuery.lte("starts_at", new Date(toDate).toISOString());

    const { data: evRows, error: evErr } = await evQuery.order("starts_at", { ascending: true });
    if (evErr) { alert(evErr.message); return; }

    const evList = (evRows ?? []) as { id: string; title: string; starts_at: string }[];
    if (evList.length === 0) {
      setMsg("No events matched your filters.");
      return;
    }

    const evTitleById = new Map(evList.map((e) => [e.id, e.title]));
    const evIds = evList.map((e) => e.id);

    // 2) fetch attendance for those event ids + student info
    let attQuery = supabase
      .from("attendance")
      .select("id,event_id,status,checked_in_at,student:students(full_name)")
      .in("event_id", evIds);

    if (status) attQuery = attQuery.eq("status", status);
    // student name filter (client side since nested filter can be tricky)
    const { data: attRows, error: attErr } = await attQuery.order("checked_in_at", { ascending: true });
    if (attErr) { alert(attErr.message); return; }

    const raw = (attRows ?? []) as any[];

    const filtered = studentName.trim()
      ? raw.filter((r) => (r.student?.full_name ?? "").toLowerCase().includes(studentName.trim().toLowerCase()))
      : raw;

    // build detail rows
    const d: DetailRow[] = filtered.map((r) => {
      const stName = r.student?.full_name ?? "—";
      const stStatus = String(r.status ?? "");
      const pts = typeMap.get(stStatus.toLowerCase()) ?? 0;
      return {
        student_name: stName,
        event_title: evTitleById.get(r.event_id) ?? "—",
        status: stStatus,
        points: pts,
        checked_in_at: r.checked_in_at,
      };
    });

    setDetails(d);

    // build points rows per student
    const agg = new Map<string, { full_name: string; total_events: Set<string>; points_sum: number }>();
    for (const r of d) {
      const key = r.student_name;
      const cur = agg.get(key) ?? { full_name: key, total_events: new Set<string>(), points_sum: 0 };
      cur.total_events.add(r.event_title + "|" + r.checked_in_at.slice(0, 10)); // coarse uniqueness
      cur.points_sum += r.points;
      agg.set(key, cur);
    }

    const out: PointsRow[] = Array.from(agg.values()).map((a) => ({
      full_name: a.full_name,
      total_events: a.total_events.size,
      points_sum: Number(a.points_sum.toFixed(3)),
      date_range: dateRangeLabel(),
    }));

    out.sort((a, b) => (sortDir === "desc" ? b.points_sum - a.points_sum : a.points_sum - b.points_sum));
    setPointsRows(out);
  }

  function exportCsvPoints() {
    if (pointsRows.length === 0) return;

    const header = ["Student name", "Total events", "Points", "Date range"];
    const lines = [
      header.map(csvEscape).join(","),
      ...pointsRows.map((r) => [r.full_name, r.total_events, r.points_sum, r.date_range].map(csvEscape).join(",")),
    ];

    // UTF-8 BOM to keep Amharic readable in Excel
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance_points.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsvDetails() {
    if (details.length === 0) return;

    const header = ["Student name", "Event", "Attendance type", "Points", "Entry time"];
    const lines = [
      header.map(csvEscape).join(","),
      ...details.map((r) => [r.student_name, r.event_title, r.status, r.points, new Date(r.checked_in_at).toLocaleString()].map(csvEscape).join(",")),
    ];

    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attendance_details.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportXlsxPoints() {
    if (pointsRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(pointsRows.map((r) => ({
      "Student name": r.full_name,
      "Total events": r.total_events,
      "Points": r.points_sum,
      "Date range": r.date_range,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Points");
    XLSX.writeFile(wb, "attendance_points.xlsx");
  }

  function exportXlsxDetails() {
    if (details.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(details.map((r) => ({
      "Student name": r.student_name,
      "Event": r.event_title,
      "Attendance type": r.status,
      "Points": r.points,
      "Entry time": new Date(r.checked_in_at).toLocaleString(),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(wb, "attendance_details.xlsx");
  }

  function exportPdfPoints() {
    if (pointsRows.length === 0) return;
    const doc = new jsPDF();
    doc.text("Attendance points report", 14, 14);

    autoTable(doc, {
      head: [["Student name", "Total events", "Points", "Date range"]],
      body: pointsRows.map((r) => [r.full_name, String(r.total_events), String(r.points_sum), r.date_range]),
      startY: 20,
      styles: { fontSize: 9 },
    });

    doc.save("attendance_points.pdf");
  }

  function exportPdfDetails() {
    if (details.length === 0) return;
    const doc = new jsPDF();
    doc.text("Attendance details report", 14, 14);

    autoTable(doc, {
      head: [["Student name", "Event", "Type", "Points", "Entry time"]],
      body: details.map((r) => [r.student_name, r.event_title, r.status, String(r.points), new Date(r.checked_in_at).toLocaleString()]),
      startY: 20,
      styles: { fontSize: 9 },
    });

    doc.save("attendance_details.pdf");
  }

  return (
    <div className="grid gap-4">
      <Card title="Reports & export">
        {loading ? <div className="text-sm text-gray-600">Loading…</div> : (
          <div className="grid gap-3">
            <div className="grid md:grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Class (required)</label>
                <Select value={classId} onChange={(e) => { setClassId(e.target.value); setMsg(""); setDetails([]); setPointsRows([]); }}>
                  <option value="">-- choose --</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Event (optional)</label>
                <Select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={!classId}>
                  <option value="">All events</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {new Date(e.starts_at).toLocaleString()} — {e.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Attendance type (optional)</label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">All</option>
                  {types.map((t) => <option key={t.id} value={t.name.toLowerCase()}>{t.name}</option>)}
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">From date (optional)</label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">To date (optional)</label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium">Student name (optional)</label>
                <Input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Filter by name…" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={runReports} disabled={!classId}>Run report</Button>
              <Select value={sortDir} onChange={(e) => setSortDir(e.target.value as any)} className="w-36">
                <option value="desc">Points ↓</option>
                <option value="asc">Points ↑</option>
              </Select>
            </div>

            <Hint>All filters are optional except the class. Use Event filter to report a specific event.</Hint>
            {msg ? <div className="text-sm p-3 rounded-lg border bg-gray-50">{msg}</div> : null}
          </div>
        )}
      </Card>

      <Card title="Points summary">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="secondary" onClick={exportCsvPoints} disabled={pointsRows.length === 0}>Export CSV</Button>
          <Button variant="secondary" onClick={exportXlsxPoints} disabled={pointsRows.length === 0}>Export Excel</Button>
          <Button variant="secondary" onClick={exportPdfPoints} disabled={pointsRows.length === 0}>Export PDF</Button>
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Student name</th>
                <th className="text-left p-2">Total events</th>
                <th className="text-left p-2">Points</th>
                <th className="text-left p-2">Date range</th>
              </tr>
            </thead>
            <tbody>
              {pointsRows.map((r) => (
                <tr key={r.full_name} className="border-t">
                  <td className="p-2">{r.full_name}</td>
                  <td className="p-2">{r.total_events}</td>
                  <td className="p-2">{r.points_sum}</td>
                  <td className="p-2">{r.date_range}</td>
                </tr>
              ))}
              {pointsRows.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={4}>No data yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Attendance details">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="secondary" onClick={exportCsvDetails} disabled={details.length === 0}>Export CSV</Button>
          <Button variant="secondary" onClick={exportXlsxDetails} disabled={details.length === 0}>Export Excel</Button>
          <Button variant="secondary" onClick={exportPdfDetails} disabled={details.length === 0}>Export PDF</Button>
        </div>

        <div className="overflow-auto border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Student</th>
                <th className="text-left p-2">Event</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Points</th>
                <th className="text-left p-2">Entry time</th>
              </tr>
            </thead>
            <tbody>
              {details.map((r, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2">{r.student_name}</td>
                  <td className="p-2">{r.event_title}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="p-2">{r.points}</td>
                  <td className="p-2">{new Date(r.checked_in_at).toLocaleString()}</td>
                </tr>
              ))}
              {details.length === 0 ? <tr><td className="p-2 text-gray-600" colSpan={5}>No data yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

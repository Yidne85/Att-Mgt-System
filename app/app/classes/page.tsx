"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { requireProfile } from "../../../lib/profile";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";
import Papa from "papaparse";
import QRCode from "qrcode";

type Org = { id: string; name: string };
type ClassRow = { id: string; name: string };
type StudentRow = { id: string; full_name: string; gender: string; qr_data_url: string | null };

function uid(len=12){
  const chars="abcdefghijklmnopqrstuvwxyz0123456789";
  let s="";
  for(let i=0;i<len;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

export default function ClassesPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [copyFromClassId, setCopyFromClassId] = useState<string>("");
  const [editClassName, setEditClassName] = useState("");
  const [loading, setLoading] = useState(true);

  const classRow = useMemo(() => classes.find(c => c.id === selectedClass) ?? null, [classes, selectedClass]);
  const className = classRow?.name ?? "";

  async function loadAll() {
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { window.location.href = "/login"; return; }
      const p = await requireProfile();
      if (p.role !== "admin") { window.location.href = "/app"; return; }
      const userId = sess.session.user.id;
    const { data: orgRow } = await supabase.from("orgs").select("*").eq("id", p.org_id).single();
    setOrg(orgRow);
    const { data: cls } = await supabase.from("classes").select("*").eq("org_id", orgRow.id).order("name");
    setClasses(cls ?? []);
    setLoading(false);
  }

  async function loadStudents(classId: string) {
  setSelectedClass(classId);
  // Load students enrolled in this class via class_students join table
  const { data: cs, error } = await supabase
    .from("class_students")
    .select("student:students(id,full_name,gender,qr_data_url)")
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  if (error) console.error(error);
  const st = (cs ?? []).map((r: any) => r.student).filter(Boolean);
  setStudents(st);
  const cr = classes.find((c) => c.id === classId);
  setEditClassName(cr?.name ?? "");
}


  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (selectedClass) {
      const cr = classes.find(c => c.id === selectedClass);
      setEditClassName(cr?.name ?? "");
    }
  }, [classes, selectedClass]);

  async function createClass() {
  if (!org?.id || !newClassName.trim()) return;

  const { data: created, error } = await supabase
    .from("classes")
    .insert({ org_id: org.id, name: newClassName.trim() })
    .select("id")
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  // Optional: copy students from another class (reuse same student IDs / QR codes)
  const newClassId = created.id as string;
  if (copyFromClassId) {
    const { data: existingEnrollments, error: e2 } = await supabase
      .from("class_students")
      .select("student_id")
      .eq("class_id", copyFromClassId);

    if (e2) {
      alert(e2.message);
    } else {
      const rows = (existingEnrollments ?? []).map((r: any) => ({ class_id: newClassId, student_id: r.student_id }));
      if (rows.length) {
        const { error: e3 } = await supabase.from("class_students").insert(rows);
        if (e3) alert(e3.message);
      }
    }
  }

  setNewClassName("");
  setCopyFromClassId("");
  await loadAll();
}


  async function updateClass() {
    if (!selectedClass || !editClassName.trim()) return;
    const { error } = await supabase.from("classes").update({ name: editClassName.trim() }).eq("id", selectedClass);
    if (error) { alert(error.message); return; }
    await loadAll();
  }

  async function deleteClass() {
    if (!selectedClass) return;
    if (!confirm("Delete this class? This will also delete its students and attendance records for its events.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", selectedClass);
    if (error) { alert(error.message); return; }
    setSelectedClass("");
    setStudents([]);
    await loadAll();
  }

  async function addStudent(full_name: string, gender: string) {
  if (!selectedClass || !org) return;

  const name = full_name.toString().trim();
  if (!name) return;

  // Try to reuse existing student in this org (basic de-dup by name+gender)
  const { data: existing } = await supabase
    .from("students")
    .select("id,full_name,gender,qr_data_url")
    .eq("org_id", org.id)
    .ilike("full_name", name)
    .eq("gender", gender)
    .limit(1);

  let studentId: string | null = existing && existing[0] ? existing[0].id : null;

  if (!studentId) {
    const student_uid = uid(14);
    const qrPayload = JSON.stringify({ student_uid });
    const qr_data_url = await QRCode.toDataURL(qrPayload, { margin: 1, scale: 6 });

    const { data: created, error: createErr } = await supabase
      .from("students")
      .insert({
        org_id: org.id,
        student_uid,
        full_name: name,
        gender,
        qr_data_url,
      })
      .select("id")
      .single();

    if (createErr) {
      alert(createErr.message);
      return;
    }
    studentId = created.id;
  }

  // Enroll into class (one QR across classes)
  const { error: enrollErr } = await supabase.from("class_students").insert({
    class_id: selectedClass,
    student_id: studentId,
  });

  if (enrollErr) alert(enrollErr.message);
  await loadStudents(selectedClass);
}


  async function deleteStudent(studentId: string) {
  if (!selectedClass) return;
  if (!confirm("Remove this student from this class?")) return;

  const { error } = await supabase
    .from("class_students")
    .delete()
    .eq("class_id", selectedClass)
    .eq("student_id", studentId);

  if (error) alert(error.message);
  await loadStudents(selectedClass);
}


  async function onCsvUpload(file: File) {
    if (!selectedClass) { alert("Select a class first"); return; }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows = (results.data as any[]).map(r => ({
          full_name: (r.full_name ?? r.name ?? "").toString().trim(),
          gender: (r.gender ?? "").toString().trim() || "unknown",
        })).filter(r => r.full_name);

        for (const r of rows) {
          await addStudent(r.full_name, r.gender);
        }
        alert(`Imported ${rows.length} students.`);
      },
      error: (err: any) => alert(err.message),
    });
  }

  return (
    <div className="grid gap-4">
      <Card title="Create class">
  <div className="grid sm:grid-cols-3 gap-2 max-w-3xl">
    <Input placeholder="Class name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
    <Select value={copyFromClassId} onChange={(e) => setCopyFromClassId(e.target.value)}>
      <option value="">(Optional) Copy students from class…</option>
      {classes.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </Select>
    <Button onClick={createClass} disabled={!newClassName.trim() || !org?.id}>Create</Button>
  </div>
  <Hint>Tip: Copying students keeps the same QR code across classes.</Hint>
</Card>


      <Card title="Classes">
        {loading ? <div className="text-sm text-gray-600">Loading…</div> : (
          <div className="grid gap-3">
            <div className="max-w-md">
              <label className="text-sm font-medium">Select class</label>
              <Select value={selectedClass} onChange={(e) => loadStudents(e.target.value)}>
                <option value="">-- choose --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            {selectedClass ? (
              <div className="grid gap-4">
                <Card title="Edit class">
                  <div className="grid sm:grid-cols-3 gap-2 max-w-2xl items-end">
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium">Class name</label>
                      <Input value={editClassName} onChange={(e) => setEditClassName(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={updateClass} disabled={!editClassName.trim()}>Update</Button>
                      <Button variant="secondary" onClick={deleteClass}>Delete</Button>
                    </div>
                  </div>
                </Card>

                <Card title={`Students in ${className}`}>
                  <div className="grid gap-3">
                    <AddStudentForm onAdd={addStudent} />

                    <div className="border-t pt-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <label className="text-sm font-medium">Upload students via CSV</label>
                          <input
                            type="file"
                            accept=".csv"
                            className="block mt-2 text-sm"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) onCsvUpload(f);
                            }}
                          />
                        </div>
                        <a className="text-sm text-blue-700 underline" href="/sample_students.csv" download>
                          Download sample CSV
                        </a>
                      </div>
                      <Hint>CSV columns: full_name, gender (or name, gender). Example row: John Doe,male</Hint>
                    </div>

                    <div className="overflow-auto border rounded-lg">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2">Full name</th>
                            <th className="text-left p-2">Gender</th>
                            <th className="text-left p-2">QR preview</th>
                            <th className="text-left p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map(s => (
                            <tr key={s.id} className="border-t">
                              <td className="p-2">{s.full_name}</td>
                              <td className="p-2">{s.gender}</td>
                              <td className="p-2">
                                {s.qr_data_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img alt="QR" src={s.qr_data_url} className="w-12 h-12 border rounded" />
                                ) : "—"}
                              </td>
                              <td className="p-2">
                                <div className="flex flex-wrap gap-2">
                                  <a className="text-blue-700 underline" href={`/app/student/${s.id}`}>View / Edit / Download</a>
                                  <Button variant="secondary" onClick={() => deleteStudent(s.id)}>Delete</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {students.length === 0 ? (
                            <tr><td className="p-2 text-gray-600" colSpan={4}>No students yet.</td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              </div>
            ) : <div className="text-sm text-gray-600">Select a class to manage students.</div>}
          </div>
        )}
      </Card>
    </div>
  );
}

function AddStudentForm({ onAdd }: { onAdd: (full_name: string, gender: string) => Promise<void> }) {
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("male");
  const [loading, setLoading] = useState(false);

  return (
    <div className="grid sm:grid-cols-3 gap-2 items-end">
      <div className="sm:col-span-2">
        <label className="text-sm font-medium">Add student</label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
      </div>
      <div>
        <label className="text-sm font-medium">Gender</label>
        <Select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="male">male</option>
          <option value="female">female</option>
          <option value="other">other</option>
          <option value="unknown">unknown</option>
        </Select>
      </div>
      <div className="sm:col-span-3">
        <Button
          onClick={async () => {
            if (!fullName.trim()) return;
            setLoading(true);
            await onAdd(fullName.trim(), gender);
            setFullName("");
            setLoading(false);
          }}
          disabled={loading || !fullName.trim()}
        >
          {loading ? "Adding..." : "Add student"}
        </Button>
      </div>
    </div>
  );
}

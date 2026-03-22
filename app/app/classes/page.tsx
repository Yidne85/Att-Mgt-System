"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { requireProfile } from "../../../lib/profile";
import { Button, Card, Input, Select, Hint } from "../../../components/ui";
import Papa from "papaparse";
import { makeStudentQrDataUrl } from "../../../lib/qr";

type Org = { id: string; name: string };
type ClassRow = { id: string; name: string };
type StudentRow = { id: string; full_name: string; gender: string; qr_data_url: string | null };

function uid(len = 12) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [updateCopyFromClassId, setUpdateCopyFromClassId] = useState<string>("");
  const [sourceStudents, setSourceStudents] = useState<StudentRow[]>([]);
  const [selectedImportStudentIds, setSelectedImportStudentIds] = useState<string[]>([]);
  const [loadingSourceStudents, setLoadingSourceStudents] = useState(false);
  const [copyingStudents, setCopyingStudents] = useState(false);
  const [sourceStudentSearch, setSourceStudentSearch] = useState("");

  const classRow = useMemo(() => classes.find((c) => c.id === selectedClass) ?? null, [classes, selectedClass]);
  const className = classRow?.name ?? "";

  const total = students.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pagedStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return students.slice(start, start + pageSize);
  }, [students, page, pageSize]);

  const filteredSourceStudents = useMemo(() => {
    const q = sourceStudentSearch.trim().toLowerCase();
    if (!q) return sourceStudents;

    return sourceStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.gender.toLowerCase().includes(q)
    );
  }, [sourceStudents, sourceStudentSearch]);

  useEffect(() => {
    setPage(1);
  }, [selectedClass, students.length, pageSize]);

  async function loadAll() {
    setLoading(true);

    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      window.location.href = "/login";
      return;
    }

    const p = await requireProfile();
    if (p.role !== "admin") {
      window.location.href = "/app";
      return;
    }

    const { data: orgRow, error: orgErr } = await supabase.from("orgs").select("*").eq("id", p.org_id).single();
    if (orgErr || !orgRow) {
      alert(orgErr?.message ?? "Organization not found");
      setLoading(false);
      return;
    }

    setOrg(orgRow as Org);

    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("*")
      .eq("org_id", orgRow.id)
      .order("name");

    if (clsErr) {
      alert(clsErr.message);
      setClasses([]);
      setLoading(false);
      return;
    }

    setClasses((cls ?? []) as ClassRow[]);
    setLoading(false);
  }

  async function loadStudents(classId: string) {
    setSelectedClass(classId);

    const { data: cs, error } = await supabase
      .from("class_students")
      .select("created_at, student:students(id,full_name,gender,qr_data_url)")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    const st = (cs ?? []).map((r: any) => r.student).filter(Boolean);
    setStudents(st);

    const cr = classes.find((c) => c.id === classId);
    setEditClassName(cr?.name ?? "");
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (selectedClass) {
      const cr = classes.find((c) => c.id === selectedClass);
      setEditClassName(cr?.name ?? "");
    }
  }, [classes, selectedClass]);

  async function createClass() {
    if (!org?.id || !newClassName.trim()) return;

    const trimmed = newClassName.trim();

    const { data: existingClass } = await supabase
      .from("classes")
      .select("id")
      .eq("org_id", org.id)
      .eq("name", trimmed)
      .maybeSingle();

    if (existingClass) {
      alert("A class with this name already exists.");
      return;
    }

    const { data: created, error } = await supabase
      .from("classes")
      .insert({ org_id: org.id, name: trimmed })
      .select("id")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    const newClassId = created.id as string;

    if (copyFromClassId) {
      const { data: existingEnrollments, error: e2 } = await supabase
        .from("class_students")
        .select("student_id")
        .eq("class_id", copyFromClassId);

      if (e2) {
        alert(e2.message);
      } else {
        const rows = (existingEnrollments ?? []).map((r: any) => ({
          class_id: newClassId,
          student_id: r.student_id,
        }));

        if (rows.length) {
          const { error: e3 } = await supabase.from("class_students").insert(rows);
          if (e3) alert(e3.message);
        }
      }
    }

    setNewClassName("");
    setCopyFromClassId("");
    await loadAll();
    alert("Class created.");
  }

  async function updateClass() {
    if (!selectedClass || !editClassName.trim() || !org?.id) return;

    const trimmed = editClassName.trim();

    const { data: existingDuplicate } = await supabase
      .from("classes")
      .select("id")
      .eq("org_id", org.id)
      .eq("name", trimmed)
      .neq("id", selectedClass)
      .maybeSingle();

    if (existingDuplicate) {
      alert("A class with this name already exists.");
      return;
    }

    const { error } = await supabase
      .from("classes")
      .update({ name: trimmed })
      .eq("id", selectedClass);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
    alert("Class updated.");
  }

  async function deleteClass() {
    if (!selectedClass) return;
    if (!confirm("Delete this class? This will also delete its events and attendance records.")) return;

    const { error } = await supabase.from("classes").delete().eq("id", selectedClass);
    if (error) {
      alert(error.message);
      return;
    }

    setSelectedClass("");
    setStudents([]);
    setUpdateCopyFromClassId("");
    setSourceStudents([]);
    setSelectedImportStudentIds([]);
    await loadAll();
    alert("Class deleted.");
  }

  async function addStudent(full_name: string, gender: string) {
    if (!selectedClass || !org) return;

    const name = full_name.toString().trim();
    if (!name) return;

    const { data: existing, error: exErr } = await supabase
      .from("students")
      .select("id")
      .eq("org_id", org.id)
      .eq("full_name", name)
      .eq("gender", gender)
      .limit(1);

    if (exErr) {
      alert(exErr.message);
      return;
    }

    let studentId: string | null = existing && existing[0] ? existing[0].id : null;

    if (!studentId) {
      const student_uid = uid(14);
      const qr_data_url = await makeStudentQrDataUrl(student_uid, name);

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

    const { error: enrollErr } = await supabase.from("class_students").insert({
      class_id: selectedClass,
      student_id: studentId,
    });

    if (enrollErr) {
      alert(enrollErr.message);
    } else {
      alert("Student added.");
    }

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

    if (error) {
      alert(error.message);
      return;
    }

    await loadStudents(selectedClass);
    alert("Student removed from class.");
  }

  async function onCsvUpload(file: File) {
    if (!selectedClass) {
      alert("Select a class first");
      return;
    }

    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, "utf-8");
    });

    const clean = text.replace(/^\uFEFF/, "");

    Papa.parse(clean, {
      header: true,
      skipEmptyLines: true,
      complete: async (results: any) => {
        const rows = (results.data as any[])
          .map((r) => ({
            full_name: (r.full_name ?? r.name ?? "").toString().trim(),
            gender: (r.gender ?? "").toString().trim() || "unknown",
          }))
          .filter((r) => r.full_name);

        for (const r of rows) {
          await addStudent(r.full_name, r.gender);
        }

        alert(`Imported ${rows.length} students.`);
      },
      error: (err: any) => alert(err.message),
    });
  }

  async function loadSourceStudentsForImport(classId: string) {
    setUpdateCopyFromClassId(classId);
    setSelectedImportStudentIds([]);
    setSourceStudents([]);
    setSourceStudentSearch("");

    if (!classId) return;

    try {
      setLoadingSourceStudents(true);

      const { data: cs, error } = await supabase
        .from("class_students")
        .select("student:students(id,full_name,gender,qr_data_url)")
        .eq("class_id", classId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const st = (cs ?? []).map((r: any) => r.student).filter(Boolean);
      setSourceStudents(st);
    } catch (e: any) {
      alert(e?.message ?? "Failed to load source students.");
    } finally {
      setLoadingSourceStudents(false);
    }
  }

  function toggleImportStudent(studentId: string) {
    setSelectedImportStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  }

  function toggleSelectAllSourceStudents() {
    const filteredIds = filteredSourceStudents.map((s) => s.id);

    const allFilteredSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedImportStudentIds.includes(id));

    if (allFilteredSelected) {
      setSelectedImportStudentIds((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      );
    } else {
      setSelectedImportStudentIds((prev) => [
        ...new Set([...prev, ...filteredIds]),
      ]);
    }
  }

  async function importSelectedStudentsToExistingClass() {
    if (!selectedClass) {
      alert("Select a class first.");
      return;
    }

    if (!updateCopyFromClassId) {
      alert("Choose a source class.");
      return;
    }

    if (selectedClass === updateCopyFromClassId) {
      alert("You cannot import students from the same class.");
      return;
    }

    if (selectedImportStudentIds.length === 0) {
      alert("Select at least one student to import.");
      return;
    }

    try {
      setCopyingStudents(true);

      const { data: existingEnrollments, error: existingErr } = await supabase
        .from("class_students")
        .select("student_id")
        .eq("class_id", selectedClass);

      if (existingErr) throw existingErr;

      const existingIds = new Set((existingEnrollments ?? []).map((r: any) => r.student_id));

      const rowsToInsert = selectedImportStudentIds
        .filter((studentId) => !existingIds.has(studentId))
        .map((studentId) => ({
          class_id: selectedClass,
          student_id: studentId,
        }));

      if (rowsToInsert.length === 0) {
        alert("All selected students are already added to this class.");
        return;
      }

      const { error: insertErr } = await supabase
        .from("class_students")
        .insert(rowsToInsert);

      if (insertErr) throw insertErr;

      alert(`Imported ${rowsToInsert.length} selected students successfully.`);
      setUpdateCopyFromClassId("");
      setSourceStudents([]);
      setSelectedImportStudentIds([]);
      setSourceStudentSearch("");
      await loadStudents(selectedClass);
    } catch (e: any) {
      alert(e?.message ?? "Failed to import selected students.");
    } finally {
      setCopyingStudents(false);
    }
  }

  return null;
}

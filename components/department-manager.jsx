
"use client";

import { useMemo, useState } from "react";
import { Pencil, Check, X, Search } from "lucide-react";

function initialsOf(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "•";
  const parts = s.split(/\s+/g).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function combinedLabel(email, name = "") {
  const e = String(email || "").trim();
  const n = String(name || "").trim();
  if (e && n) return `${n} <${e}>`;
  return e || "";
}

function avatar({ photoUrl, fallbackLabel }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />;
  }
  return (
    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold">
      {initialsOf(fallbackLabel)}
    </div>
  );
}

export default function DepartmentManager({
  campusLabel = "",
  departments = {},
  institutionalProfiles = {},
  editingDept,
  setEditingDept,
  onUpdateDepartment,
}) {
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    // Flatten grouped departments: one card per department_name
    const out = [];
    for (const [deptName, arr] of Object.entries(departments || {})) {
      const rec = Array.isArray(arr) && arr.length > 0 ? arr[0] : { department_name: deptName, email: "", supervisor_email: "", campus: "" };
      const email = String(rec.email || "").trim();
      const supervisor = String(rec.supervisor_email || "").trim();

      const emailKey = email.toLowerCase();
      const supKey = supervisor.toLowerCase();

      const emailName = rec.email_display_name || institutionalProfiles[emailKey]?.name || "";
      const emailPhoto = rec.email_photo_url || institutionalProfiles[emailKey]?.photoUrl || "";

      const supName = rec.supervisor_display_name || institutionalProfiles[supKey]?.name || "";
      const supPhoto = rec.supervisor_photo_url || institutionalProfiles[supKey]?.photoUrl || "";

      out.push({
        department_name: deptName,
        email,
        emailName,
        emailPhoto,
        supervisor_email: supervisor,
        supName,
        supPhoto,
        campus: rec.campus || "",
      });
    }

    const term = q.trim().toLowerCase();
    if (!term) return out.sort((a, b) => a.department_name.localeCompare(b.department_name, "es"));
    return out
      .filter((r) => {
        const hay = `${r.department_name} ${r.email} ${r.emailName} ${r.supervisor_email} ${r.supName}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => a.department_name.localeCompare(b.department_name, "es"));
  }, [departments, institutionalProfiles, q]);

  const [draft, setDraft] = useState({ email: "", supervisor_email: "" });

  function onStartEdit(d) {
    setEditingDept(d.department_name);
    setDraft({ email: d.email || "", supervisor_email: d.supervisor_email || "" });
  }
  function onCancel() {
    setEditingDept(null);
    setDraft({ email: "", supervisor_email: "" });
  }
  async function onSave(name) {
    if (!onUpdateDepartment) return;
    await onUpdateDepartment(name, draft.email || "", draft.supervisor_email || "");
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="font-title text-xl text-[#004E66]">Departamentos — {campusLabel}</h2>
        <div className="relative w-full sm:w-72">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar departamento, correo o nombre…"
            className="w-full rounded-lg border border-[#cde6eb] bg-white px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
          />
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((d) => {
          const isEditing = editingDept === d.department_name;
          return (
            <div key={d.department_name} className="rounded-lg border border-[#cde6eb] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-base font-semibold text-[#004E66]">{d.department_name}</div>
                  <div className="mt-1 text-xs text-gray-500">Plantel: {d.campus || "—"}</div>
                </div>
                {!isEditing ? (
                  <button
                    onClick={() => onStartEdit(d)}
                    className="inline-flex items-center gap-1 rounded-md bg-[#E6F3F6] text-[#004E66] px-3 py-1 text-xs font-medium hover:bg-[#E6F3F6]/80"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSave(d.department_name)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#6DA544] text-white px-3 py-1 text-xs font-medium hover:bg-[#5ea23c]"
                      aria-label="Guardar"
                    >
                      <Check className="h-4 w-4" />
                      Guardar
                    </button>
                    <button
                      onClick={onCancel}
                      className="inline-flex items-center gap-1 rounded-md bg-[#ffe9e3] text-[#7a200f] px-3 py-1 text-xs font-medium hover:bg-[#ffd3c8]"
                      aria-label="Cancelar"
                    >
                      <X className="h-4 w-4" />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  {avatar({
                    photoUrl: d.emailPhoto,
                    fallbackLabel: d.emailName || d.email || d.department_name,
                  })}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Correo principal</div>
                    {!isEditing ? (
                      <div className="text-sm text-gray-800 truncate">{combinedLabel(d.email, d.emailName) || "—"}</div>
                    ) : (
                      <input
                        type="email"
                        value={draft.email}
                        onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                        placeholder="correo@institucional"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {avatar({
                    photoUrl: d.supPhoto,
                    fallbackLabel: d.supName || d.supervisor_email || d.department_name,
                  })}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Supervisor</div>
                    {!isEditing ? (
                      <div className="text-sm text-gray-800 truncate">{combinedLabel(d.supervisor_email, d.supName) || "—"}</div>
                    ) : (
                      <input
                        type="email"
                        value={draft.supervisor_email}
                        onChange={(e) => setDraft((p) => ({ ...p, supervisor_email: e.target.value }))}
                        placeholder="supervisor@institucional"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="col-span-full">
            <div className="rounded-lg border border-dashed border-[#cde6eb] bg-white p-6 text-center text-sm text-gray-600">
              No se encontraron departamentos que coincidan con tu búsqueda.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


"use client";

import { useMemo, useState } from "react";
import { Pencil, Check, X, Search, Trash2, PlusCircle } from "lucide-react";

function initialsOf(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "•";
  const parts = s.split(/\s+/g).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function Avatar({ photoUrl, fallbackLabel }) {
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
  onDeleteDepartment,
  onCreateDepartment,
}) {
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const out = [];
    for (const [deptName, arr] of Object.entries(departments || {})) {
      const rec = Array.isArray(arr) && arr.length > 0 ? arr[0] : { department_name: deptName, email: "", supervisor_email: "", campus: "" };
      const email = String(rec.email || "").trim();
      const supervisor = String(rec.supervisor_email || "").trim();

      const emailKey = email.toLowerCase();
      const supKey = supervisor.toLowerCase();

      // Prefer Directory fullName from API: email_display_name is set by API using name.fullName
      const emailFullName = rec.email_display_name || institutionalProfiles[emailKey]?.name || "";
      const supFullName = rec.supervisor_display_name || institutionalProfiles[supKey]?.name || "";

      const emailPhoto = rec.email_photo_url || institutionalProfiles[emailKey]?.photoUrl || "";
      const supPhoto = rec.supervisor_photo_url || institutionalProfiles[supKey]?.photoUrl || "";

      out.push({
        department_name: deptName,
        email,
        emailFullName,
        emailPhoto,
        supervisor_email: supervisor,
        supFullName,
        supPhoto,
        campus: rec.campus || "",
      });
    }

    const term = q.trim().toLowerCase();
    if (!term) return out.sort((a, b) => a.department_name.localeCompare(b.department_name, "es"));
    return out
      .filter((r) => {
        const hay = `${r.department_name} ${r.email} ${r.emailFullName} ${r.supervisor_email} ${r.supFullName}`.toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => a.department_name.localeCompare(b.department_name, "es"));
  }, [departments, institutionalProfiles, q]);

  const [draft, setDraft] = useState({ email: "", supervisor_email: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [newDept, setNewDept] = useState({ department_name: "", email: "", supervisor_email: "" });

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

  async function onCreate() {
    const handler = onCreateDepartment || onUpdateDepartment;
    if (!handler) return;
    if (!newDept.department_name) return;
    await handler(newDept.department_name, newDept.email || "", newDept.supervisor_email || "");
    setNewDept({ department_name: "", email: "", supervisor_email: "" });
    setCreateOpen(false);
  }

  async function onDelete(name) {
    if (!onDeleteDepartment) return;
    const ok = window.confirm(`¿Eliminar el departamento "${name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    await onDeleteDepartment(name);
  }

  function EmailRow({ title, fullName, email, photoUrl, isEditing, value, onChange }) {
    return (
      <div className="flex items-start gap-3">
        <Avatar photoUrl={photoUrl} fallbackLabel={fullName || email || title} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wide text-gray-500">{title}</div>
          {!isEditing ? (
            <>
              <div className="text-sm font-medium text-gray-900 truncate">{fullName || "—"}</div>
              <div className="text-xs text-gray-600 truncate">{email || "—"}</div>
            </>
          ) : (
            <input
              type="email"
              value={value}
              onChange={(e) => onChange?.(e.target.value)}
              placeholder="correo@institucional"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="font-title text-xl text-[#004E66]">Departamentos — {campusLabel}</h2>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar departamento, correo o nombre…"
              className="w-full rounded-lg border border-[#cde6eb] bg-white px-3 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
            />
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          </div>
          <button
            onClick={() => setCreateOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md bg-[#6DA544] text-white px-3 py-2 text-sm font-medium hover:bg-[#5ea23c]"
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="mt-4 rounded-lg border border-[#cde6eb] bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-[#004E66] mb-3">Agregar departamento</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-1">
              <label className="text-xs text-gray-600">Nombre del departamento</label>
              <input
                type="text"
                value={newDept.department_name}
                onChange={(e) => setNewDept((p) => ({ ...p, department_name: e.target.value }))}
                placeholder="Ej. Psicología"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-gray-600">Correo principal</label>
              <input
                type="email"
                value={newDept.email}
                onChange={(e) => setNewDept((p) => ({ ...p, email: e.target.value }))}
                placeholder="correo@institucional"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-gray-600">Correo de supervisor</label>
              <input
                type="email"
                value={newDept.supervisor_email}
                onChange={(e) => setNewDept((p) => ({ ...p, supervisor_email: e.target.value }))}
                placeholder="supervisor@institucional"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-md bg-[#6DA544] text-white px-3 py-2 text-sm font-medium hover:bg-[#5ea23c]"
            >
              <Check className="h-4 w-4" />
              Guardar
            </button>
            <button
              onClick={() => {
                setCreateOpen(false);
                setNewDept({ department_name: "", email: "", supervisor_email: "" });
              }}
              className="inline-flex items-center gap-2 rounded-md bg-[#ffe9e3] text-[#7a200f] px-3 py-2 text-sm font-medium hover:bg-[#ffd3c8]"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onStartEdit(d)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#E6F3F6] text-[#004E66] px-3 py-1 text-xs font-medium hover:bg-[#E6F3F6]/80"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(d.department_name)}
                      className="inline-flex items-center gap-1 rounded-md bg-[#ffe9e3] text-[#7a200f] px-3 py-1 text-xs font-medium hover:bg-[#ffd3c8]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
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
                <EmailRow
                  title="Correo principal"
                  fullName={d.emailFullName}
                  email={d.email}
                  photoUrl={d.emailPhoto}
                  isEditing={isEditing}
                  value={draft.email}
                  onChange={(val) => setDraft((p) => ({ ...p, email: val }))}
                />
                <EmailRow
                  title="Supervisor"
                  fullName={d.supFullName}
                  email={d.supervisor_email}
                  photoUrl={d.supPhoto}
                  isEditing={isEditing}
                  value={draft.supervisor_email}
                  onChange={(val) => setDraft((p) => ({ ...p, supervisor_email: val }))}
                />
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

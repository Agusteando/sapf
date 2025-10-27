
"use client";

import { useMemo, useState, useCallback } from "react";
import { Pencil, Trash2, Plus, Search, Mail, UserCircle } from "lucide-react";

/**
 * DepartmentManager
 * - Lists departments and allows create/update/delete.
 * - Shows Workspace full display name (prefixed with "Nombre: ") under each email.
 * Props:
 *  - campusLabel: string
 *  - departments: { [department_name]: Array<{ email, supervisor_email, email_display_name?, supervisor_display_name?, email_photo_url?, supervisor_photo_url? }> }
 *  - institutionalProfiles: { [emailLower]: { fullName?: string, name?: string, photoUrl?: string } }
 *  - editingDept: string|null
 *  - setEditingDept: (v) => void
 *  - onUpdateDepartment: (department_name, email, supervisor_email) => Promise
 *  - onDeleteDepartment: (department_name) => Promise
 *  - onCreateDepartment: (department_name, email, supervisor_email) => Promise
 */
export default function DepartmentManager({
  campusLabel,
  departments,
  institutionalProfiles,
  editingDept,
  setEditingDept,
  onUpdateDepartment,
  onDeleteDepartment,
  onCreateDepartment
}) {
  const [query, setQuery] = useState("");
  const [formState, setFormState] = useState({ department_name: "", email: "", supervisor_email: "" });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => {
    const items = [];
    if (departments && typeof departments === "object") {
      for (const [depName, rows] of Object.entries(departments)) {
        const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
        items.push({ depName, row: first });
      }
    }
    // Filter by department name, email, supervisor email, or display name
    const q = String(query || "").toLowerCase().trim();
    if (!q) return items.sort((a, b) => a.depName.localeCompare(b.depName, "es"));
    return items
      .filter(({ depName, row }) => {
        const em = String(row.email || "").toLowerCase();
        const sup = String(row.supervisor_email || "").toLowerCase();
        const dn = String(row.email_display_name || "").toLowerCase();
        const sdn = String(row.supervisor_display_name || "").toLowerCase();
        return (
          depName.toLowerCase().includes(q) ||
          em.includes(q) ||
          sup.includes(q) ||
          dn.includes(q) ||
          sdn.includes(q)
        );
      })
      .sort((a, b) => a.depName.localeCompare(b.depName, "es"));
  }, [departments, query]);

  const profileFor = useCallback(
    (email) => {
      const key = String(email || "").toLowerCase();
      return institutionalProfiles?.[key] || {};
    },
    [institutionalProfiles]
  );

  const ensureNombrePrefix = (s) => {
    const v = String(s || "").trim();
    if (!v) return "";
    return /^nombre\s*:/i.test(v) ? v : `Nombre: ${v}`;
  };

  const displayNameForEmail = useCallback(
    (email, fallbackDisplayFromApi) => {
      // Prefer API-provided display name (already prefixed if present)
      const apiName = String(fallbackDisplayFromApi || "").trim();
      if (apiName) return ensureNombrePrefix(apiName.replace(/^nombre:\s*/i, "").trim());
      // Else resolve from Workspace profiles (prefer fullName)
      const prof = profileFor(email);
      const nn = prof?.fullName || prof?.name || "";
      return nn ? ensureNombrePrefix(nn) : "";
    },
    [profileFor]
  );

  const onEdit = (depName, row) => {
    setEditingDept(depName);
    setCreating(false);
    setFormState({
      department_name: depName,
      email: String(row?.email || ""),
      supervisor_email: String(row?.supervisor_email || "")
    });
  };

  const onCancel = () => {
    setEditingDept(null);
    setCreating(false);
    setFormState({ department_name: "", email: "", supervisor_email: "" });
  };

  const onSave = async () => {
    if (!formState.department_name) return;
    setSaving(true);
    try {
      await onUpdateDepartment(formState.department_name, formState.email, formState.supervisor_email);
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  const onCreate = async () => {
    if (!formState.department_name) return;
    setSaving(true);
    try {
      await onCreateDepartment(formState.department_name, formState.email, formState.supervisor_email);
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setEditingDept(null);
    setFormState({ department_name: "", email: "", supervisor_email: "" });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="font-title text-xl sm:text-2xl text-[#004E66]">
          Departamentos — {campusLabel || "Plantel"}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#018B9C] text-white hover:bg-[#017a88] transition"
          >
            <Plus className="w-5 h-5" />
            Nuevo
          </button>
        </div>
      </div>

      <div className="mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar departamento, correo o nombre…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
          />
        </div>
      </div>

      {creating && (
        <div className="mt-4 border border-[#cde6eb] rounded-lg p-4 bg-[#F7FCFD]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm font-semibold text-gray-700">Departamento</label>
              <input
                type="text"
                value={formState.department_name}
                onChange={(e) => setFormState((p) => ({ ...p, department_name: e.target.value }))}
                className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                placeholder="Ej. Administración"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-semibold text-gray-700">Correo principal</label>
              <input
                type="email"
                value={formState.email}
                onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
                className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                placeholder="correo@institucional.tld"
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Supervisor</label>
              <input
                type="email"
                value={formState.supervisor_email}
                onChange={(e) => setFormState((p) => ({ ...p, supervisor_email: e.target.value }))}
                className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                placeholder="supervisor@institucional.tld"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onCreate}
              disabled={saving || !formState.department_name}
              className="px-4 py-2 rounded bg-[#6DA544] text-white hover:bg-[#5f9440] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3">
        {list.map(({ depName, row }) => {
          const isEditing = editingDept === depName;
          const email = String(row?.email || "");
          const supervisor_email = String(row?.supervisor_email || "");

          const primaryDisplay = displayNameForEmail(email, row?.email_display_name);
          const supervisorDisplay = displayNameForEmail(supervisor_email, row?.supervisor_display_name);

          const primaryPhoto = String(row?.email_photo_url || profileFor(email)?.photoUrl || "");
          const supervisorPhoto = String(row?.supervisor_photo_url || profileFor(supervisor_email)?.photoUrl || "");

          const initials = depName
            .split(/\s+/g)
            .filter(Boolean)
            .map((w) => w[0]?.toUpperCase?.() || "")
            .slice(0, 2)
            .join("");

          return (
            <div key={depName} className="rounded-lg border border-[#cde6eb] bg-white">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E6F3F6] text-[#004E66] font-semibold flex items-center justify-center">
                    {initials || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{depName}</div>
                    <div className="text-xs text-gray-600 truncate">Plantel: {campusLabel || "—"}</div>
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(depName, row)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#E6F3F6] text-[#004E66] hover:bg-[#d9eef3]"
                    >
                      <Pencil className="w-4 h-4" /> Editar
                    </button>
                    <button
                      onClick={() => onDeleteDepartment(depName)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#ffe9e3] text-[#7a200f] hover:bg-[#ffdcd2]"
                    >
                      <Trash2 className="w-4 h-4" /> Eliminar
                    </button>
                  </div>
                )}
              </div>

              {!isEditing && (
                <div className="px-4 pb-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#004E66]" />
                      Correo principal
                    </div>
                    <div className="mt-2 text-sm text-gray-900 break-all">
                      {email ? email : "—"}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {primaryPhoto ? (
                        <img
                          src={primaryPhoto}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      )}
                      <div className="text-sm text-gray-700 truncate" title={primaryDisplay}>
                        {primaryDisplay || "Nombre: —"}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-3">
                    <div className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#004E66]" />
                      Supervisor
                    </div>
                    <div className="mt-2 text-sm text-gray-900 break-all">
                      {supervisor_email ? supervisor_email : "—"}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {supervisorPhoto ? (
                        <img
                          src={supervisorPhoto}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <UserCircle className="w-6 h-6 text-gray-400" />
                      )}
                      <div className="text-sm text-gray-700 truncate" title={supervisorDisplay}>
                        {supervisorDisplay || "Nombre: —"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="px-4 pb-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <label className="text-sm font-semibold text-gray-700">Departamento</label>
                      <input
                        type="text"
                        value={formState.department_name}
                        onChange={(e) => setFormState((p) => ({ ...p, department_name: e.target.value }))}
                        className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                        placeholder="Ej. Administración"
                      />
                    </div>
                    <div className="grid gap-1">
                      <label className="text-sm font-semibold text-gray-700">Correo principal</label>
                      <input
                        type="email"
                        value={formState.email}
                        onChange={(e) => setFormState((p) => ({ ...p, email: e.target.value }))}
                        className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                        placeholder="correo@institucional.tld"
                      />
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                      <label className="text-sm font-semibold text-gray-700">Supervisor</label>
                      <input
                        type="email"
                        value={formState.supervisor_email}
                        onChange={(e) => setFormState((p) => ({ ...p, supervisor_email: e.target.value }))}
                        className="p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                        placeholder="supervisor@institucional.tld"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={onSave}
                      disabled={saving || !formState.department_name}
                      className="px-4 py-2 rounded bg-[#6DA544] text-white hover:bg-[#5f9440] disabled:opacity-60"
                    >
                      {saving ? "Guardando…" : "Guardar"}
                    </button>
                    <button
                      onClick={onCancel}
                      className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

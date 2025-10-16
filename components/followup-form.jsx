
"use client";

import { useMemo, useState } from "react";
import SearchableSelect from "@/components/searchable-select";
import EmailChips from "@/components/email-chips";
import { CornerDownRight, Check, Loader2, Lock, Pin } from "lucide-react";
import { departmentOptions, combinedEmailLabel } from "@/lib/ui";

export default function FollowupForm({
  ticket,
  depts,
  institutionalNames = {},
  sending = false,
  error = "",
  onSubmit
}) {
  const [resolution, setResolution] = useState("");
  const [status, setStatus] = useState(ticket.status || "0");
  const [targetDepartment, setTargetDepartment] = useState(ticket.target_department || ticket.original_department || "");
  const [ccEmails, setCcEmails] = useState([]);

  const deptOptions = useMemo(() => departmentOptions(depts, institutionalNames), [depts, institutionalNames]);
  const deptRec = depts?.[targetDepartment]?.[0] || {};
  const deptEmail = deptRec.email || "";
  const deptNameDisp = institutionalNames[String(deptEmail).toLowerCase()] || deptRec.email_display_name || "";
  const supEmail = deptRec.supervisor_email || "";
  const supNameDisp = institutionalNames[String(supEmail).toLowerCase()] || deptRec.supervisor_display_name || "";

  const deptCombined = combinedEmailLabel(deptEmail, deptNameDisp);
  const supCombined = combinedEmailLabel(supEmail, supNameDisp);

  async function submitFollowup() {
    if (!resolution || resolution.trim().length === 0) {
      return onSubmit?.({ error: "Escribe el texto del seguimiento." });
    }
    onSubmit?.({
      resolution,
      status,
      targetDepartment: targetDepartment || "",
      ccEmails
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <div className="text-sm text-gray-600">
          Fecha: {new Date(ticket.fecha).toLocaleString("es-MX")}
        </div>
        <div className="font-title text-lg text-[#004E66]">
          Folio {ticket.folio_number || String(ticket.id).padStart(5, "0")}
        </div>
        <div className="flex items-center gap-3">
          {ticket.status === "1" ? (
            <span className="badge badge-green">
              <Lock className="w-4 h-4" /> Cerrado
            </span>
          ) : (
            <span className="badge badge-coral">
              <Pin className="w-4 h-4" /> Abierto
            </span>
          )}
          <span className="text-sm text-gray-700">
            Plantel: {ticket.school_code || ticket.campus}
          </span>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="font-semibold text-gray-700">Motivo</div>
        <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">{ticket.reason}</div>
      </div>

      <div className="grid gap-2">
        <div className="font-semibold text-gray-700">Resolución inicial</div>
        <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">{ticket.resolution || "—"}</div>
      </div>

      <div className="grid gap-1">
        <div className="font-semibold text-gray-800">Agregar seguimiento</div>
        <textarea
          rows={6}
          className="w-full rounded border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
          placeholder="Describe el seguimiento..."
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <label className="text-sm font-medium text-gray-700">Estatus</label>
          <select
            className="rounded border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="0">Abierto</option>
            <option value="1">Cerrado</option>
          </select>
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Canalizar a</label>
          <SearchableSelect
            options={[
              { value: "", label: "(Sin cambio)", email: "", displayName: "", combined: "" },
              ...deptOptions
            ]}
            value={targetDepartment}
            onChange={(value) => setTargetDepartment(value)}
            placeholder="Seleccionar departamento..."
            getOptionLabel={(opt) => opt.label}
            getOptionValue={(opt) => opt.value}
            renderOption={(opt) => (
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">{opt.label}</span>
                {opt.combined && (
                  <span className="text-xs text-gray-500 mt-0.5">{opt.combined}</span>
                )}
              </div>
            )}
          />
        </div>
      </div>

      <div className="rounded border border-[#cde6eb] bg-[#E6F3F6] p-3 text-sm text-[#004E66]">
        {targetDepartment ? (
          <>
            Un correo será enviado a: <strong>{deptCombined || "—"}</strong>
            {supEmail ? (
              <> y copia a su supervisor: <strong>{supCombined}</strong></>
            ) : (
              <> (sin supervisor configurado)</>
            )}
            <div className="mt-2">
              Correos adicionales (internos):
              <EmailChips
                value={ccEmails}
                onChange={setCcEmails}
                suggestions={
                  Object.values(depts || {}).flat().map((r) => {
                    const e = String(r.email || "").toLowerCase();
                    return ({
                      email: r.email,
                      name: r.email_display_name || (institutionalNames[e] || "")
                    });
                  }).concat(
                    Object.values(depts || {}).flat().map((r) => {
                      const e2 = String(r.supervisor_email || "").toLowerCase();
                      return ({
                        email: r.supervisor_email,
                        name: r.supervisor_display_name || (institutionalNames[e2] || "")
                      });
                    })
                  ).filter((x) => x.email)
                }
              />
            </div>
          </>
        ) : (
          <>Selecciona un departamento para enviar notificación</>
        )}
      </div>

      {Array.isArray(ticket.followups) && ticket.followups.length > 0 && (
        <div className="grid gap-2">
          <div className="font-semibold text-gray-800">Seguimientos ({ticket.followups.length})</div>
          <div className="grid gap-2">
            {ticket.followups.map((f, idx) => (
              <div key={`${f.id || idx}-${idx}`} className="rounded border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                    <CornerDownRight className="w-4 h-4" />
                    <span>{new Date(f.fecha).toLocaleString("es-MX")}</span>
                  </div>
                  <div className="text-xs rounded-full px-2 py-0.5 border border-gray-300 text-gray-700">
                    {f.target_department || "—"}
                  </div>
                </div>
                <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{f.resolution}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded border border-[#ffd3c8] bg-[#ffe9e3] p-3 text-sm text-[#7a200f]">
          {error}
        </div>
      )}

      <div className="mt-2">
        <button
          onClick={submitFollowup}
          disabled={sending}
          className="btn btn-accent disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
          Guardar seguimiento
        </button>
      </div>
    </div>
  );
}

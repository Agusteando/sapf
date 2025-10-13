
"use client";

import React, { useMemo, useState } from "react";
import { Check, Mail, Pin, Lock, CornerDownRight } from "lucide-react";

export default function TicketDetailClient({ ticket, departments }) {
  const [currentTicket, setCurrentTicket] = useState(ticket);
  const [resolution, setResolution] = useState("");
  const [status, setStatus] = useState(ticket.status || "0");
  const [targetDepartment, setTargetDepartment] = useState(ticket.target_department || "");
  const [sending, setSending] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState(() => {
    const list = [];
    if (ticket.parent_email) list.push(ticket.parent_email);
    if (ticket.department_email) list.push(ticket.department_email);
    return list.join(", ");
  });
  const [emailSubject, setEmailSubject] = useState(`Seguimiento al folio ${String(ticket.id).padStart(5, "0")}`);
  const [emailBody, setEmailBody] = useState(
    `<p>Se ha registrado un nuevo seguimiento para el folio <strong>${String(ticket.id).padStart(5, "0")}</strong>.</p>
<p><strong>Plantel:</strong> ${ticket.school_code || ticket.campus || ""}</p>
<p><strong>Padre/Madre:</strong> ${ticket.parent_name}</p>
<p><strong>Alumno:</strong> ${ticket.student_name}</p>
<p><strong>Departamento:</strong> ${targetDepartment || ticket.target_department || ticket.original_department || ""}</p>
<p><strong>Seguimiento:</strong></p>
<p>${(resolution || "").replace(/\n/g, "<br/>")}</p>`
  );
  const [error, setError] = useState("");

  const deptOptions = useMemo(() => Object.keys(departments || {}), [departments]);

  async function refreshTicket() {
    try {
      const res = await fetch(`/api/tickets/${currentTicket.id}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCurrentTicket(data);
    } catch (e) {
      // ignore
    }
  }

  async function submitFollowup() {
    setError("");
    if (!resolution || resolution.trim().length === 0) {
      setError("Escribe el texto del seguimiento.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${currentTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resolution,
          status,
          target_department: targetDepartment || ""
        })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error || "No se pudo guardar el seguimiento.");
        setSending(false);
        return;
      }

      // Optionally send email
      if (sendEmail) {
        const recipients = emailTo
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (recipients.length > 0) {
          const html = emailBody || `<p>${resolution.replace(/\n/g, "<br/>")}</p>`;
          const emailRes = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: recipients,
              subject: emailSubject || `Seguimiento al folio ${String(currentTicket.id).padStart(5, "0")}`,
              html
            })
          });
          if (!emailRes.ok) {
            const t = await emailRes.text();
            console.warn("[TicketDetailClient] email send failed", t.slice(0, 200));
          }
        }
      }

      setResolution("");
      await refreshTicket();
    } catch (e) {
      console.error("[TicketDetailClient] submit error", e);
      setError("Error de red al guardar el seguimiento.");
    }
    setSending(false);
  }

  return (
    <div className="grid gap-6">
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <div className="grid gap-3">
            <div className="text-sm text-gray-500">
              Fecha: {new Date(currentTicket.fecha).toLocaleString("es-MX")}
            </div>
            <div className="text-2xl font-bold text-gray-800">
              Folio {currentTicket.folio_number || String(currentTicket.id).padStart(5, "0")}
            </div>
            <div className="flex items-center gap-3">
              {currentTicket.status === "1" ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-green-700 text-sm">
                  <Lock className="w-4 h-4" /> Cerrado
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-red-700 text-sm">
                  <Pin className="w-4 h-4" /> Abierto
                </span>
              )}
              <span className="text-sm text-gray-600">
                Plantel: {currentTicket.school_code || currentTicket.campus}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="text-sm">
                <div className="font-semibold text-gray-700">Padre/Madre</div>
                <div className="text-gray-800">{currentTicket.parent_name}</div>
              </div>
              <div className="text-sm">
                <div className="font-semibold text-gray-700">Alumno</div>
                <div className="text-gray-800">{currentTicket.student_name}</div>
              </div>
              <div className="text-sm">
                <div className="font-semibold text-gray-700">Contacto</div>
                <div className="text-gray-800">{currentTicket.contact_method}</div>
              </div>
              <div className="text-sm">
                <div className="font-semibold text-gray-700">Correo</div>
                <div className="text-gray-800 break-all">{currentTicket.parent_email || "—"}</div>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="font-semibold text-gray-700">Motivo</div>
              <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">{currentTicket.reason}</div>
            </div>
            <div className="grid gap-2">
              <div className="font-semibold text-gray-700">Resolución inicial</div>
              <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">{currentTicket.resolution || "—"}</div>
            </div>
          </div>
          <div className="grid gap-3">
            <div className="font-semibold text-gray-800">Agregar seguimiento</div>
            <textarea
              rows={6}
              className="w-full rounded border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe el seguimiento..."
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="grid gap-1">
                <label className="text-sm font-medium text-gray-700">Estatus</label>
                <select
                  className="rounded border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="0">Abierto</option>
                  <option value="1">Cerrado</option>
                </select>
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700">Canalizar a</label>
                <select
                  className="rounded border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value)}
                >
                  <option value="">(Sin cambio)</option>
                  {deptOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-2 grid gap-2 rounded border border-blue-200 bg-blue-50 p-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                />
                <span className="text-sm font-medium text-blue-900 flex items-center gap-1">
                  <Mail className="w-4 h-4" /> Enviar notificación por correo
                </span>
              </label>
              {sendEmail && (
                <div className="grid gap-2">
                  <div className="grid gap-1">
                    <label className="text-sm text-blue-900">Para (separado por coma)</label>
                    <input
                      type="text"
                      className="rounded border border-blue-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={emailTo}
                      onChange={(e) => setEmailTo(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm text-blue-900">Asunto</label>
                    <input
                      type="text"
                      className="rounded border border-blue-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <label className="text-sm text-blue-900">Contenido</label>
                    <textarea
                      rows={5}
                      className="rounded border border-blue-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <button
                onClick={submitFollowup}
                disabled={sending}
                className="inline-flex items-center gap-2 rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
              >
                <Check className="w-5 h-5" />
                Guardar seguimiento
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="text-lg font-semibold text-gray-800 mb-3">Seguimientos</div>
        {Array.isArray(currentTicket.followups) && currentTicket.followups.length > 0 ? (
          <div className="grid gap-3">
            {currentTicket.followups.map((f, idx) => (
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
        ) : (
          <div className="text-sm text-gray-600">Sin seguimientos aún.</div>
        )}
      </div>
    </div>
  );
}

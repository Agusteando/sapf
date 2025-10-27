
"use client";

import React from "react";
import { Loader2, BarChart3, Filter, Calendar, Users } from "lucide-react";
import TicketCard from "./ticket-card";

/**
 * Dashboard
 * Displays KPI cards, filters, and a list of tickets (list form). For each ticket, it forwards
 * institutionalProfiles to TicketCard so avatars and display names render correctly.
 */
export default function Dashboard({
  kpi,
  kpiLoading,
  tickets,
  statusFilter,
  setStatusFilter,
  schoolYears,
  dashSchoolYear,
  setDashSchoolYear,
  monthsForSchoolYear,
  dashSelectedMonth,
  setDashSelectedMonth,
  onExport,
  showStats,
  setShowStats,
  distStats,
  distLoading,
  lastLoadedAt,
  loadError,
  onOpenFollowup,
  institutionalProfiles = {},
}) {
  const k = kpi || { total: 0, abiertos: 0, cerrados: 0, quejas: 0, avg_resolucion_horas: null };

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Total
          </div>
          <div className="text-2xl font-semibold text-[#004E66]">{k.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="text-xs text-gray-500">Abiertos</div>
          <div className="text-2xl font-semibold text-[#E94E1B]">{k.abiertos}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="text-xs text-gray-500">Cerrados</div>
          <div className="text-2xl font-semibold text-[#356635]">{k.cerrados}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="text-xs text-gray-500">Quejas</div>
          <div className="text-2xl font-semibold text-[#7a4a05]">{k.quejas}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col">
          <div className="text-xs text-gray-500">Prom. hrs. resolución</div>
          <div className="text-2xl font-semibold text-[#018B9C]">
            {k.avg_resolucion_horas !== null ? Math.round(k.avg_resolucion_horas) : "—"}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg shadow p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#004E66]" />
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter?.(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="0">Abierto</option>
              <option value="1">Cerrado</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#004E66]" />
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              value={dashSchoolYear || ""}
              onChange={(e) => setDashSchoolYear?.(e.target.value)}
            >
              {(schoolYears || []).map((sy) => (
                <option key={sy} value={sy}>
                  {sy}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#004E66]" />
            <select
              className="px-3 py-2 border rounded-lg text-sm"
              value={dashSelectedMonth || ""}
              onChange={(e) => setDashSelectedMonth?.(e.target.value)}
            >
              <option value="">Todo el ciclo</option>
              {(monthsForSchoolYear || []).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onExport}
            className="ml-auto btn btn-strong"
          >
            Exportar
          </button>

          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!showStats}
              onChange={(e) => setShowStats?.(e.target.checked)}
            />
            Ver distribución
          </label>
        </div>

        {loadError ? (
          <div className="text-[#7a200f] bg-[#ffe9e3] border border-[#ffd3c8] rounded p-3 text-sm">
            {loadError}
          </div>
        ) : null}

        <div className="text-xs text-gray-500">
          {kpiLoading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Actualizando…
            </span>
          ) : lastLoadedAt ? (
            <>Actualizado: {new Date(lastLoadedAt).toLocaleString("es-MX")}</>
          ) : null}
        </div>
      </section>

      {showStats && (
        <section className="bg-white rounded-lg shadow p-4">
          <div className="font-semibold text-[#004E66] mb-2">Distribución</div>
          {distLoading ? (
            <div className="text-sm text-gray-600 inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando…
            </div>
          ) : (
            <ul className="text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {(distStats || []).map((row, idx) => (
                <li key={idx} className="flex items-center justify-between border rounded px-3 py-2">
                  <span className="truncate">{row?.label || row?.name || "—"}</span>
                  <span className="font-semibold">{row?.count ?? 0}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="bg-transparent">
        <ul className="flex flex-col gap-4">
          {(tickets || []).map((t) => (
            <li key={t.id} className="w-full">
              <TicketCard
                ticket={t}
                institutionalProfiles={institutionalProfiles}
                onOpenFollowup={onOpenFollowup}
              />
            </li>
          ))}
        </ul>
        {(!tickets || tickets.length === 0) && (
          <div className="text-center text-sm text-gray-600 mt-2">
            No hay fichas para los filtros seleccionados.
          </div>
        )}
      </section>
    </div>
  );
}

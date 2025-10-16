
"use client";

import { Download, FileText, Loader2, Lock, Pin, TrendingUp } from "lucide-react";
import TicketCard from "@/components/ticket-card";

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
  onOpenFollowup
}) {
  const filteredTickets = tickets;

  return (
    <div className="p-6">
      <h1 className="font-title text-3xl text-center text-[#004E66] mb-6 tracking-tight">
        Mapa de Seguimiento de Fichas
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <label className="font-semibold text-gray-700">Ciclo Escolar:</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
              value={dashSchoolYear}
              onChange={(e) => {
                setDashSchoolYear(e.target.value);
                setDashSelectedMonth("");
              }}
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="font-semibold text-gray-700">Mes:</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
              value={dashSelectedMonth}
              onChange={(e) => setDashSelectedMonth(e.target.value)}
            >
              {monthsForSchoolYear.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:justify-between items-stretch gap-4">
          <div className="flex gap-4">
            <label
              className={`flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-colors ${
                statusFilter === "0"
                  ? "border-[#E94E1B] bg-[#ffe9e3]"
                  : "border-gray-300 hover:bg-[#E8E3D3]/40"
              }`}
            >
              <input
                type="radio"
                checked={statusFilter === "0"}
                onChange={() => setStatusFilter("0")}
                className="text-[#E94E1B]"
              />
              <Pin className="w-5 h-5 text-[#E94E1B]" />
              <span className="font-medium">
                Abiertos ({filteredTickets.length})
              </span>
            </label>
            <label
              className={`flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-colors ${
                statusFilter === "1"
                  ? "border-[#6DA544] bg-[#eaf3e6]"
                  : "border-gray-300 hover:bg-[#E8E3D3]/40"
              }`}
            >
              <input
                type="radio"
                checked={statusFilter === "1"}
                onChange={() => setStatusFilter("1")}
                className="text-[#6DA544]"
              />
              <Lock className="w-5 h-5 text-[#6DA544]" />
              <span className="font-medium">Cerrados</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="btn btn-accent shadow"
            >
              <Download className="w-5 h-5" />
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[#E6F3F6] border border-[#cde6eb] rounded-lg text-sm text-[#004E66]">
          <span className="font-semibold">Filtros:</span>
          {dashSelectedMonth
            ? ` Mes: ${monthsForSchoolYear.find((m) => m.value === dashSelectedMonth)?.label}`
            : ` Ciclo: ${dashSchoolYear}`}
          {lastLoadedAt && (
            <span className="ml-3">
              Última actualización: {lastLoadedAt.toLocaleString("es-MX")}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4" style={{ borderLeftColor: "#F7931E" }}>
          <div className="text-sm text-gray-600 flex items-center gap-2">
            Total {kpiLoading && <Loader2 className="w-3 h-3 animate-spin text-[#F7931E]" />}
          </div>
          <div className="text-3xl font-title text-[#F7931E]">{kpi.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4" style={{ borderLeftColor: "#E94E1B" }}>
          <div className="text-sm text-gray-600">Abiertos</div>
          <div className="text-3xl font-title text-[#E94E1B]">{kpi.abiertos}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4" style={{ borderLeftColor: "#6DA544" }}>
          <div className="text-sm text-gray-600">Cerrados</div>
          <div className="text-3xl font-title text-[#6DA544]">{kpi.cerrados}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4" style={{ borderLeftColor: "#004E66" }}>
          <div className="text-sm text-gray-600">Tiempo prom. cierre</div>
          <div className="text-2xl font-title text-[#004E66]">
            {kpi.avg_resolucion_horas !== null
              ? `${Number(kpi.avg_resolucion_horas).toFixed(1)} h`
              : "—"}
          </div>
        </div>
      </div>

      {showStats && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-title text-lg text-[#004E66]">Distribución por Departamento</h3>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {distLoading && <Loader2 className="w-4 h-4 animate-spin text-[#018B9C]" />} Actualizado automáticamente
            </div>
          </div>
          {distStats.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {distStats.map((item, idx) => (
                <div
                  key={`${item.depto}-${idx}`}
                  className="bg-white p-4 rounded-lg shadow border-l-4"
                  style={{ borderLeftColor: "#F7931E" }}
                >
                  <div className="text-sm text-gray-600">{item.depto}</div>
                  <div className="text-2xl font-title text-[#F7931E]">
                    {Number(item.porc).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-white rounded border text-gray-600">
              No hay datos para los filtros seleccionados.
            </div>
          )}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setShowStats(!showStats)}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            showStats
              ? "bg-[#F7931E] text-white shadow"
              : "bg-[#E8E3D3] text-[#7a4a05] hover:bg-[#E8E3D3]/80"
          }`}
        >
          <TrendingUp className="inline w-5 h-5 mr-2" />
          {showStats ? "Ocultar" : "Mostrar"} distribución
        </button>
      </div>

      {loadError ? (
        <div className="text-center py-6 bg-[#ffe9e3] border border-[#ffd3c8] rounded-lg text-[#7a200f]">
          {loadError}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            No hay fichas {statusFilter === "0" ? "abiertas" : "cerradas"} con los filtros seleccionados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onOpenFollowup={onOpenFollowup} />
          ))}
        </div>
      )}
    </div>
  );
}


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
      <h1 className="text-3xl font-extrabold text-center text-orange-600 mb-6 tracking-tight">
        Mapa de Seguimiento de Fichas
      </h1>

      <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <label className="font-semibold text-gray-700">Ciclo Escolar:</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                  ? "border-red-500 bg-red-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                checked={statusFilter === "0"}
                onChange={() => setStatusFilter("0")}
                className="text-red-600"
              />
              <Pin className="w-5 h-5 text-red-500" />
              <span className="font-medium">
                Abiertos ({filteredTickets.length})
              </span>
            </label>
            <label
              className={`flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-colors ${
                statusFilter === "1"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                checked={statusFilter === "1"}
                onChange={() => setStatusFilter("1")}
                className="text-green-600"
              />
              <Lock className="w-5 h-5 text-green-500" />
              <span className="font-medium">Cerrados</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow transition-all"
            >
              <Download className="w-5 h-5" />
              Exportar Excel
            </button>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <span className="font-semibold">Filtros:</span>
          {dashSelectedMonth
            ? ` Mes: ${monthsForSchoolYear.find((m) => m.value === dashSelectedMonth)?.label}`
            : ` Ciclo: ${dashSchoolYear}`}
          {lastLoadedAt && (
            <span className="ml-3 text-blue-700">
              Última actualización: {lastLoadedAt.toLocaleString("es-MX")}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <div className="text-sm text-gray-600 flex items-center gap-2">
            Total {kpiLoading && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
          </div>
          <div className="text-3xl font-bold text-orange-600">{kpi.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="text-sm text-gray-600">Abiertos</div>
          <div className="text-3xl font-bold text-red-600">{kpi.abiertos}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="text-sm text-gray-600">Cerrados</div>
          <div className="text-3xl font-bold text-green-600">{kpi.cerrados}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="text-sm text-gray-600">Tiempo prom. cierre</div>
          <div className="text-2xl font-bold text-purple-600">
            {kpi.avg_resolucion_horas !== null
              ? `${Number(kpi.avg_resolucion_horas).toFixed(1)} h`
              : "—"}
          </div>
        </div>
      </div>

      {showStats && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg text-gray-800">Distribución por Departamento</h3>
            <div className="text-sm text-gray-500 flex items-center gap-2">
              {distLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />} Actualizado automáticamente
            </div>
          </div>
          {distStats.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {distStats.map((item, idx) => (
                <div
                  key={`${item.depto}-${idx}`}
                  className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500"
                >
                  <div className="text-sm text-gray-600">{item.depto}</div>
                  <div className="text-2xl font-bold text-orange-600">
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
              ? "bg-orange-600 text-white shadow"
              : "bg-orange-50 text-orange-700 hover:bg-orange-100"
          }`}
        >
          <TrendingUp className="inline w-5 h-5 mr-2" />
          {showStats ? "Ocultar" : "Mostrar"} distribución
        </button>
      </div>

      {loadError ? (
        <div className="text-center py-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {loadError}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
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

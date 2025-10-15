
"use client";

import { AlertCircle, ChevronRight, Lock, Pin } from "lucide-react";

export default function TicketCard({ ticket, onOpenFollowup }) {
  return (
    <div className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow">
      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="lg:w-80 w-full">
            <div
              className={`p-5 rounded-lg ${
                ticket.status === "1"
                  ? "bg-green-50 border-2 border-green-200"
                  : "bg-red-50 border-2 border-red-200"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-500 font-medium">
                  {new Date(ticket.fecha).toLocaleDateString("es-MX", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {ticket.status === "1" ? (
                  <Lock className="w-6 h-6 text-green-600" />
                ) : (
                  <Pin className="w-6 h-6 text-red-600" />
                )}
              </div>
              <div className="font-bold text-2xl text-gray-800 mb-2">
                Folio {ticket.folio_number || String(ticket.id).padStart(5, "0")}
              </div>
              <div className="font-semibold text-lg text-gray-700">
                {ticket.parent_name}
              </div>
              <div className="text-sm text-gray-600 mb-3">{ticket.student_name}</div>
              <div className="mt-3 p-3 bg-white rounded text-sm max-h-32 overflow-auto">
                <span className="font-medium text-gray-700">Motivo:</span>
                <p className="mt-1 text-gray-600">{ticket.reason}</p>
              </div>
              {ticket.is_complaint === 1 && (
                <div className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Queja
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 text-white text-4xl font-bold shadow-lg flex items-center justify-center overflow-hidden">
                  <span>{ticket.created_by?.charAt(0) || "U"}</span>
                </div>
                <ChevronRight className="w-8 h-8 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-purple-700 mb-1">
                  {ticket.original_department}
                </div>
                <div className="text-xs text-gray-500 mb-2">{ticket.created_by}</div>
                <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg text-sm max-h-32 overflow-auto border-l-4 border-purple-500">
                  <span className="font-medium text-gray-700">Resolución:</span>
                  <p className="mt-1 text-gray-600">{ticket.resolution}</p>
                </div>
              </div>
            </div>

            {ticket.followups && ticket.followups.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-3">
                  <ChevronRight className="inline w-4 h-4 mr-1" />
                  Seguimientos ({ticket.followups.length})
                </h4>
                <div className="space-y-3">
                  {ticket.followups.map((followup, idx) => (
                    <div
                      key={`${followup.id || idx}-${idx}`}
                      className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-blue-900">
                          {followup.target_department}
                        </div>
                        <div className="text-xs text-gray-500 mb-1">
                          {new Date(followup.fecha).toLocaleString("es-MX")}
                        </div>
                        <div className="text-sm text-gray-700">{followup.resolution}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => onOpenFollowup?.(ticket)}
                className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Ver/Agregar seguimiento
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

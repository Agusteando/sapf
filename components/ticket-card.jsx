
"use client";

import { AlertCircle, ChevronRight, Lock, Pin, ShieldAlert } from "lucide-react";

export default function TicketCard({ ticket, onOpenFollowup }) {
  const isClosed = ticket.status === "1";
  const isParent = String(ticket.origin || "").toLowerCase() === "parent";
  const isHigh = Number(ticket.priority_level || 1) >= 2;

  return (
    <div className={`bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border ${isParent ? "border-[#F7931E]" : "border-transparent"}`}>
      <div className="p-6 relative">
        {isParent && (
          <div className="absolute top-3 right-3 badge badge-orange shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5" />
            De padres{isHigh ? " • Alta" : ""}
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="lg:w-80 w-full">
            <div
              className={`p-5 rounded-lg ${
                isClosed
                  ? "bg-[#eaf3e6] border-2 border-[#d9e7d2]"
                  : "bg-[#ffe9e3] border-2 border-[#ffd3c8]"
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-600 font-medium">
                  {new Date(ticket.fecha).toLocaleDateString("es-MX", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {isClosed ? (
                  <Lock className="w-6 h-6 text-[#356635]" />
                ) : (
                  <Pin className="w-6 h-6 text-[#E94E1B]" />
                )}
              </div>
              <div className="font-title text-2xl text-[#004E66] mb-2">
                Folio {ticket.folio_number || String(ticket.id).padStart(5, "0")}
              </div>
              <div className="font-semibold text-lg text-gray-800">
                {ticket.parent_name}
              </div>
              <div className="text-sm text-gray-600 mb-3">{ticket.student_name}</div>
              <div className="mt-3 p-3 bg-white rounded text-sm max-h-32 overflow-auto">
                <span className="font-semibold text-gray-700">Motivo:</span>
                <p className="mt-1 text-gray-700">{ticket.reason}</p>
              </div>
              {ticket.is_complaint === 1 && (
                <div className="mt-2 badge badge-coral">
                  <AlertCircle className="w-3 h-3" />
                  Queja
                </div>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-4">
                <div className={`relative w-24 h-24 rounded-full ${isParent ? "bg-gradient-to-br from-[#F7931E] to-[#E94E1B]" : "bg-gradient-to-br from-[#004E66] to-[#018B9C]"} text-white text-4xl font-bold shadow-lg flex items-center justify-center overflow-hidden`}>
                  <span>{ticket.created_by?.charAt(0) || "U"}</span>
                </div>
                <ChevronRight className={`${isParent ? "text-[#F7931E]" : "text-[#004E66]"} w-8 h-8`} />
              </div>
              <div className="flex-1">
                <div className={`text-sm font-semibold ${isParent ? "text-[#7a4a05]" : "text-[#004E66]"} mb-1`}>
                  {ticket.original_department}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {ticket.created_by} {isParent ? "• Origen: Padres" : ""}
                </div>
                <div className={`p-4 ${isParent ? "border-l-4 border-[#F7931E]" : "border-l-4 border-[#004E66]"} bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg text-sm max-h-32 overflow-auto`}>
                  <span className="font-semibold text-gray-700">Resolución:</span>
                  <p className="mt-1 text-gray-700">{ticket.resolution}</p>
                </div>
                {isHigh && (
                  <div className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full bg-[#fff3e6] text-[#7a4a05] border border-[#ffe3c4]">
                    Alta prioridad
                  </div>
                )}
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
                      className="flex items-start gap-3 p-3 bg-[#E6F3F6] rounded-lg"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#018B9C] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-[#004E66]">
                          {followup.target_department}
                        </div>
                        <div className="text-xs text-gray-600 mb-1">
                          {new Date(followup.fecha).toLocaleString("es-MX")}
                        </div>
                        <div className="text-sm text-gray-800">{followup.resolution}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <button
                onClick={() => onOpenFollowup?.(ticket)}
                className="btn btn-strong"
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


"use client";

import React from "react";

export default function Overlay({ open, onClose, children, title }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl shadow-lg mx-0 sm:mx-4">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b">
          <div className="text-base sm:text-lg font-semibold text-gray-800">{title || "Detalle"}</div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm"
          >
            Cerrar
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[75vh]">{children}</div>
      </div>
    </div>
  );
}

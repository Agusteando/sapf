
"use client";

import React from "react";

export default function OtherLoginPrompt({ forRole = "admin", className = "" }) {
  return (
    <div className={`w-full text-center ${className}`}>
      <div className="inline-flex flex-col gap-2 items-center text-sm text-slate-600 dark:text-slate-200">
        <div className="font-medium">
          ¿Problemas para ingresar como {forRole === "admin" ? "administrador" : "usuario"}?
        </div>
        <div>
          Contacta a soporte para habilitar tu cuenta institucional.
        </div>
        <a
          href="mailto:soporte@iecs.edu.mx?subject=Acceso%20panel%20administrativo"
          className="inline-block px-4 py-2 rounded-lg bg-fuchsia-600 text-white hover:bg-fuchsia-700 transition-colors"
        >
          Escribir a soporte
        </a>
      </div>
    </div>
  );
}

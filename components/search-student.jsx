
"use client";

import React, { useState } from "react";
import { Search, Users } from "lucide-react";

export default function SearchStudent({ students, onSelected, placeholder = "Buscar estudiante o padre (mínimo 3 caracteres)..." }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);

  const doSearch = (term) => {
    setSearchTerm(term);
    if (term.length < 3) {
      setResults([]);
      return;
    }
    const allStudents = Array.isArray(students) ? students : [];
    const filtered = allStudents.filter((student) => {
      const fullName = `${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim().toLowerCase();
      const parentName = `${student.nombre_padre ?? ""} ${student.apellido_paterno_padre ?? ""} ${student.nombre_madre ?? ""} ${student.apellido_paterno_madre ?? ""}`.trim().toLowerCase();
      const haystack = `${fullName} ${parentName}`.trim();
      return haystack.includes(term.toLowerCase());
    });
    setResults(filtered.slice(0, 10));
  };

  return (
    <div className="mb-6">
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={placeholder}
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => doSearch(e.target.value)}
          />
        </div>

        {results.length > 0 && (
          <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {results.map((student, idx) => {
              const photo = student?.matricula?.foto || "";
              const fullName = `${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim();
              const parentLine = `Padre: ${student.nombre_padre || ""} ${student.apellido_paterno_padre || ""}`.trim();
              return (
                <div
                  key={idx}
                  className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                  onClick={() => {
                    onSelected?.(student);
                    setResults([]);
                    setSearchTerm("");
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 rounded-full ring-2 ring-emerald-400 overflow-hidden flex-shrink-0">
                      {photo ? (
                        <img
                          src={photo}
                          alt={fullName}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-bold">
                          {(student.nombres || "?").charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-base">
                        {fullName}
                      </div>
                      <div className="text-sm text-gray-600">
                        Grado: {student.grado} • Grupo: {student.grupo} • Matrícula: {student.matricula?.id || student.matricula || "—"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {parentLine}
                      </div>
                      {Array.isArray(student.siblings) && student.siblings.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Hermanos: {student.siblings.map((s) => s.nombres).join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

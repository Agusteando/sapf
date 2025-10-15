
"use client";

import { useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import SearchStudent from "@/components/search-student";

export default function NursingReport({
  selectedCampusLabel,
  students,
  onStudentSelected,
  onSubmit,
  sending = false
}) {
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [report, setReport] = useState("");
  const [actions, setActions] = useState("");
  const [studentPhoto, setStudentPhoto] = useState("");

  function handleStudentSelected(student) {
    const pName = student.nombre_padre
      ? `${student.nombre_padre} ${student.apellido_paterno_padre ?? ""}`.trim()
      : "";
    const sName = `${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim();
    const pEmail = student.email_padre || student.email_madre || "";
    const photo = student?.matricula?.foto || "";

    setStudentName(sName);
    setParentName(pName);
    setParentEmail(pEmail);
    setStudentPhoto(photo);
    onStudentSelected?.(student, { studentName: sName, parentName: pName, parentEmail: pEmail, studentPhoto: photo });
  }

  function submit() {
    onSubmit?.({
      parentName,
      parentEmail,
      studentName,
      report,
      actions,
      studentPhoto
    });
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
          <Stethoscope className="w-6 h-6" />
          Reporte de Enfermería
        </h2>
        <div className="text-sm text-gray-500">{selectedCampusLabel}</div>
      </div>

      <div className="mb-4 p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 text-emerald-900">
        Esta sección es la única que envía reportes por correo a padres/madres/tutores.
      </div>

      <SearchStudent
        students={students}
        onSelected={handleStudentSelected}
        placeholder="Buscar estudiante o padre para llenar datos..."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1">
          <label className="text-sm font-semibold text-gray-700">Alumno</label>
          <div className="flex items-center gap-3">
            {studentName ? (
              <div className="relative w-12 h-12 rounded-full ring-2 ring-emerald-400 overflow-hidden">
                {studentName && (
                  <img src={studentPhoto || ""} alt={studentName} loading="lazy" className="w-full h-full object-cover" />
                )}
              </div>
            ) : null}
            <input
              type="text"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-1">
          <label className="text-sm font-semibold text-gray-700">Padre/Madre/Tutor</label>
          <input
            type="text"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
        </div>
        <div className="grid gap-1 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">Correo de contacto (padres)</label>
          <input
            type="email"
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">Reporte / Observaciones</label>
          <textarea
            rows={5}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            value={report}
            onChange={(e) => setReport(e.target.value)}
            placeholder="Describa síntomas, incidentes, medidas aplicadas, etc."
          />
        </div>
        <div className="grid gap-1 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">Acciones / Recomendaciones (opcional)</label>
          <textarea
            rows={4}
            className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            value={actions}
            onChange={(e) => setActions(e.target.value)}
            placeholder="Indicaciones para seguimiento en casa, etc."
          />
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={submit}
          disabled={sending}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Stethoscope className="w-5 h-5" />}
          Enviar Reporte a Padres
        </button>
      </div>
    </div>
  );
}

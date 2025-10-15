
"use client";

import { useState } from "react";
import { Check, Edit2 } from "lucide-react";
import { combinedEmailLabel } from "@/lib/ui";

export default function DepartmentManager({
  campusLabel,
  departments,
  institutionalNames = {},
  editingDept,
  setEditingDept,
  onUpdateDepartment
}) {
  const [editData, setEditData] = useState({});

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500">
          Configuración de Departamentos — {campusLabel}
        </h2>
      </div>

      <div className="grid gap-4">
        {Object.entries(departments).map(([deptName, deptData]) => {
          const rec = deptData?.[0] || {};
          const deptEmail = rec.email || "";
          const supEmail = rec.supervisor_email || "";
          const deptNameDisp = institutionalNames[deptEmail.toLowerCase?.() || ""] || rec.email_display_name || "";
          const supNameDisp = institutionalNames[supEmail.toLowerCase?.() || ""] || rec.supervisor_display_name || "";
          const deptCombined = combinedEmailLabel(deptEmail, deptNameDisp) || "—";
          const supCombined = combinedEmailLabel(supEmail, supNameDisp) || "—";

          return (
            <div
              key={deptName}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-semibold text-lg mb-3 text-gray-800">
                    {deptName}
                  </div>
                  {editingDept === deptName ? (
                    <div className="grid gap-3">
                      <div>
                        <label className="text-sm text-gray-600 font-medium">
                          Email del departamento
                        </label>
                        <input
                          type="email"
                          placeholder="correo@dominio.com"
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          defaultValue={deptEmail}
                          onChange={(e) =>
                            setEditData({ ...editData, email: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600 font-medium">
                          Email del supervisor
                        </label>
                        <input
                          type="email"
                          placeholder="supervisor@dominio.com"
                          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          defaultValue={supEmail}
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              supervisor: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            onUpdateDepartment(
                              deptName,
                              editData.email || deptEmail,
                              editData.supervisor || supEmail
                            )
                          }
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingDept(null)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-[100px]">Departamento:</span>
                        <span className={deptEmail ? "text-gray-900" : "text-gray-400"}>
                          {deptCombined}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-[100px]">Supervisor:</span>
                        <span className={supEmail ? "text-gray-900" : "text-gray-400"}>
                          {supCombined}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {!editingDept && (
                  <button
                    onClick={() => setEditingDept(deptName)}
                    className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    aria-label="Editar departamento"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

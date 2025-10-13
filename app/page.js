
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Search,
  Users,
  AlertCircle,
  Save,
  FileText,
  TrendingUp,
  ChevronRight,
  Lock,
  Pin,
  Edit2,
  Check,
  Download,
  BarChart3,
  Mail,
  CornerDownRight,
  RefreshCw
} from "lucide-react";
import Overlay from "@/components/overlay";

export default function ParentAttentionSystem() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedCampus, setSelectedCampus] = useState("PMB");
  const [tickets, setTickets] = useState([]);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [defaultSchoolYear, setDefaultSchoolYear] = useState("");

  const [kpi, setKpi] = useState({ total: 0, abiertos: 0, cerrados: 0, quejas: 0, avg_resolucion_horas: null });
  const [kpiLoading, setKpiLoading] = useState(false);
  const lastGoodKpiRef = useRef(null);

  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followTicket, setFollowTicket] = useState(null);
  const [followDepts, setFollowDepts] = useState({});

  const [formData, setFormData] = useState({
    contactMethod: "email",
    isComplaint: false,
    parentName: "",
    studentName: "",
    phoneNumber: "",
    parentEmail: "",
    reason: "",
    resolution: "",
    appointmentDate: new Date().toISOString().slice(0, 16),
    noAppointment: false,
    targetDepartment: "",
    status: "0",
    selectedDepartment: "",
    existingOpenTicketId: null,
  });

  // Dashboard-specific state (manual fetch)
  const [dashStatusFilter, setDashStatusFilter] = useState("0");
  const [dashSchoolYear, setDashSchoolYear] = useState("");
  const [dashSelectedMonth, setDashSelectedMonth] = useState("");
  const [dashShowAllOpen, setDashShowAllOpen] = useState(true);
  const [dashLastLoadedAt, setDashLastLoadedAt] = useState(null);
  const [dashLoadError, setDashLoadError] = useState("");

  // Distribution stats (manual fetch)
  const [showStats, setShowStats] = useState(false);
  const [distStats, setDistStats] = useState([]);
  const [distLoading, setDistLoading] = useState(false);

  // Expose a simple refresh signal for when user adds new tickets/followups
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refreshTicketsAndKpi = useCallback(() => {
    // Now only marks intent; fetching still requires user clicking the button
    console.log("[UI] refresh requested; click 'Cargar/Actualizar' to fetch latest from MySQL.");
    setRefreshNonce((n) => n + 1);
  }, []);

  const campuses = [
    { value: "PMB", label: "Primaria Baja Metepec" },
    { value: "PMA", label: "Primaria Alta Metepec" },
    { value: "PT", label: "Primaria Toluca" },
    { value: "SM", label: "Secundaria Metepec" },
    { value: "ST", label: "Secundaria Toluca" },
    { value: "CM", label: "Casita Metepec" },
    { value: "CT", label: "Casita Toluca" },
    { value: "DM", label: "Desarrollo Metepec" },
  ];

  const fallbackDepartmentOptions = [
    "Administración",
    "Dirección",
    "Control Escolar",
    "Mercadotecnía",
    "Psicología",
    "Pedagogía Español",
    "Pedagogía Inglés",
    "Artes y Deportes",
  ];

  // Load school years once (minor DB read; kept to power the month selector)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/stats/school-years", { cache: "no-store" });
        if (!mounted) return;
        if (!r.ok) {
          throw new Error("school-years not ok");
        }
        const data = await r.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (mounted) {
          setSchoolYears(items);
          setDefaultSchoolYear(data?.default || items[0] || "");
          // Initialize dashboard school year
          setDashSchoolYear((prev) => prev || data?.default || items[0] || "");
        }
      } catch (e) {
        console.warn("[app/page] failed to fetch school years", e);
        const now = new Date();
        const y = now.getFullYear();
        const base = now.getMonth() >= 7 ? y : y - 1;
        const fallback = [];
        for (let i = 0; i < 6; i++) {
          fallback.push(`${base - i}-${base - i + 1}`);
        }
        if (mounted) {
          setSchoolYears(fallback);
          setDefaultSchoolYear(fallback[0]);
          setDashSchoolYear((prev) => prev || fallback[0]);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Fetch helpers gated by current view to avoid hitting DB when not needed
  const fetchStudentData = useCallback(async (campus) => {
    console.log("[students] fetching for campus:", campus);
    setLoading(true);
    try {
      const response = await fetch(`/api/students/${campus}`, { cache: "no-store", headers: { "x-client": "sapf-app" } });
      if (!response.ok) {
        setStudents([]);
      } else {
        const data = await response.json();
        const arr = Array.isArray(data?.students) ? data.students : [];
        setStudents(arr);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
      setStudents([]);
    }
    setLoading(false);
  }, []);

  function chooseDefaultOriginDepartment(grouped) {
    const names = Object.keys(grouped);
    if (names.length === 0) return "";
    const priority = [
      "Control Escolar",
      "Dirección",
      "Administración",
      "Psicología",
      "Pedagogía Español",
      "Pedagogía Inglés",
    ];
    for (const p of priority) {
      if (names.includes(p)) return p;
    }
    return names.sort((a, b) => a.localeCompare(b, "es"))[0];
  }

  const fetchDepartments = useCallback(async () => {
    console.log("[departments] fetching for campus:", selectedCampus);
    try {
      const response = await fetch(`/api/departments/${selectedCampus}`, { cache: "no-store", headers: { "x-client": "sapf-app" } });
      if (!response.ok) {
        setDepartments({});
        setFormData((prev) => ({
          ...prev,
          selectedDepartment: prev.selectedDepartment || fallbackDepartmentOptions[0],
        }));
        return;
      }
      const data = await response.json();
      const grouped = (Array.isArray(data) ? data : []).reduce((acc, dept) => {
        if (!acc[dept.department_name]) acc[dept.department_name] = [];
        acc[dept.department_name].push(dept);
        return acc;
      }, {});
      setDepartments(grouped);

      setFormData((prev) => {
        const current = prev.selectedDepartment;
        const available = Object.keys(grouped);
        let next = current;
        if (!current || !available.includes(current)) {
          next = chooseDefaultOriginDepartment(grouped) || fallbackDepartmentOptions[0];
        }
        return { ...prev, selectedDepartment: next };
      });
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments({});
    }
  }, [selectedCampus]);

  const fetchDepartmentsForCampus = useCallback(async (campusCode) => {
    try {
      const response = await fetch(`/api/departments/${encodeURIComponent(campusCode)}`, { cache: "no-store", headers: { "x-client": "sapf-app" } });
      if (!response.ok) return {};
      const data = await response.json();
      const grouped = (Array.isArray(data) ? data : []).reduce((acc, dept) => {
        if (!acc[dept.department_name]) acc[dept.department_name] = [];
        acc[dept.department_name].push(dept);
        return acc;
      }, {});
      return grouped;
    } catch (e) {
      console.warn("[app/page] fetchDepartmentsForCampus error", e);
      return {};
    }
  }, []);

  // Only load students/departments when on relevant views
  useEffect(() => {
    if (currentView === "form") {
      fetchStudentData(selectedCampus);
      fetchDepartments();
    } else if (currentView === "departments") {
      fetchDepartments();
    }
  }, [currentView, selectedCampus, fetchStudentData, fetchDepartments]);

  const checkDuplicate = async (parentName) => {
    if (!parentName || parentName.length < 3) return null;
    try {
      const response = await fetch(
        `/api/search-duplicate?parent_name=${encodeURIComponent(parentName)}`,
        { cache: "no-store", headers: { "x-client": "sapf-app" } }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data[0];
    } catch (error) {
      console.error("Error checking duplicate:", error);
      return null;
    }
  };

  const submitTicket = async () => {
    if (!formData.parentName || !formData.reason || !formData.resolution) {
      alert("Por favor complete todos los campos requeridos");
      return;
    }

    try {
      const departmentEmail =
        departments[formData.selectedDepartment]?.[0]?.email || "";

      if (formData.existingOpenTicketId && formData.appendToExisting) {
        const response = await fetch(`/api/tickets/${formData.existingOpenTicketId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
          body: JSON.stringify({
            resolution: formData.resolution,
            status: formData.status,
            target_department: formData.targetDepartment,
          }),
        });
        const result = await response.json();
        if (!response.ok || !result?.success) {
          alert("No se pudo agregar el seguimiento al folio existente.");
          return;
        }
        alert(`Seguimiento agregado al folio ${String(formData.existingOpenTicketId).padStart(5, "0")}.`);
        setFormData((prev) => ({
          ...prev,
          resolution: "",
          targetDepartment: "",
          appendToExisting: false,
          existingOpenTicketId: null,
        }));
        // Inform user to manually refresh the dashboard
        console.log("[UI] Seguimiento guardado. Use el botón 'Cargar/Actualizar' para ver datos actualizados.");
        return;
      }

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
        body: JSON.stringify({
          campus: selectedCampus,
          contact_method: formData.contactMethod,
          is_complaint: formData.isComplaint ? 1 : 0,
          parent_name: formData.parentName,
          student_name: formData.studentName,
          phone_number: formData.phoneNumber,
          parent_email: formData.parentEmail,
          reason: formData.reason,
          resolution: formData.resolution,
          appointment_date: formData.noAppointment ? null : formData.appointmentDate,
          target_department: formData.targetDepartment,
          department_email: departmentEmail,
          created_by: "Current User",
          original_department: formData.selectedDepartment || "General",
          status: formData.status,
        }),
      });

      const result = await response.json();
      if (response.ok && result.success) {
        alert(`Ficha generada exitosamente. Folio: ${result.folioNumber}`);
        setFormData({
          contactMethod: "email",
          isComplaint: false,
          parentName: "",
          studentName: "",
          phoneNumber: "",
          parentEmail: "",
          reason: "",
          resolution: "",
          appointmentDate: new Date().toISOString().slice(0, 16),
          noAppointment: false,
          targetDepartment: "",
          status: "0",
          selectedDepartment: chooseDefaultOriginDepartment(departments) || "",
          existingOpenTicketId: null,
          appendToExisting: false,
        });
        console.log("[UI] Ficha creada. Use 'Cargar/Actualizar' para actualizar el tablero.");
      } else {
        alert(result?.error || "No se pudo generar la ficha");
      }
    } catch (error) {
      console.error("Error submitting ticket:", error);
      alert("Error al generar la ficha");
    }
  };

  const updateDepartment = async (deptName, email, supervisor) => {
    try {
      await fetch(`/api/departments/${selectedCampus}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
        body: JSON.stringify({
          email,
          department_name: deptName,
          supervisor_email: supervisor,
        }),
      });
      alert("Departamento actualizado exitosamente");
      fetchDepartments();
      setEditingDept(null);
    } catch (error) {
      console.error("Error updating department:", error);
      alert("Error al actualizar departamento");
    }
  };

  const exportToExcel = () => {
    window.open(`/api/export-excel?campus=${selectedCampus}&status=`, "_blank");
  };

  function holderDisplayFor(deptName) {
    const entry = departments?.[deptName]?.[0] || {};
    const cand =
      entry.responsable_name ||
      entry.display_name ||
      entry.in_charge_name ||
      entry.incharge_name ||
      entry.owner_name ||
      entry.supervisor_name ||
      entry.name ||
      entry.full_name ||
      entry.supervisor_email ||
      entry.email ||
      "";
    return String(cand);
  }

  const StudentSearch = () => {
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState([]);
    const [duplicate, setDuplicate] = useState(null);

    const searchStudents = (term) => {
      setSearchTerm(term);
      if (term.length < 3) {
        setResults([]);
        return;
      }

      const allStudents = Array.isArray(students) ? students : [];
      const filtered = allStudents.filter((student) => {
        const fullName = `${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim().toLowerCase();
        const parentName = `${student.nombre_padre ?? ""} ${student.apellido_paterno_padre ?? ""} ${student.nombre_madre ?? ""} ${student.apellido_paterno_madre ?? ""}`.trim().toLowerCase();
        return (
          fullName.includes(term.toLowerCase()) ||
          parentName.includes(term.toLowerCase())
        );
      });
      setResults(filtered.slice(0, 10));
    };

    const selectStudent = async (student) => {
      const parentName = student.nombre_padre
        ? `${student.nombre_padre} ${student.apellido_paterno_padre ?? ""}`.trim()
        : "";

      setFormData((prev) => ({
        ...prev,
        studentName: `${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim(),
        parentName,
        phoneNumber: student.telefono_padre || student.telefono_madre || "",
        parentEmail: student.email_padre || student.email_madre || "",
      }));

      const dup = await checkDuplicate(parentName);
      setDuplicate(dup);
      setFormData((prev) => ({
        ...prev,
        existingOpenTicketId: dup?.dup === 1 ? dup?.id : null,
        appendToExisting: dup?.dup === 1 ? true : prev.appendToExisting,
      }));

      setResults([]);
      setSearchTerm("");
    };

    return (
      <div className="mb-6">
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar estudiante o padre (mínimo 3 caracteres)..."
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => searchStudents(e.target.value)}
            />
          </div>

          {results.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {results.map((student, idx) => (
                <div
                  key={idx}
                  className="p-4 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors"
                  onClick={() => selectStudent(student)}
                >
                  <div className="font-semibold text-lg">
                    {student.nombres} {student.apellido_paterno}{" "}
                    {student.apellido_materno}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Grado: {student.grado} | Grupo: {student.grupo} | Matrícula:{" "}
                    {student.matricula}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Padre: {student.nombre_padre}{" "}
                    {student.apellido_paterno_padre}
                  </div>
                  {Array.isArray(student.siblings) && student.siblings.length > 0 && (
                    <div className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Hermanos: {student.siblings.map((s) => s.nombres).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {duplicate && duplicate.dup === 1 && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">
              Ya existe un folio abierto para {formData.parentName}. Folio:{" "}
              {String(duplicate.id).padStart(5, "0")} — se agregará seguimiento por defecto.
            </span>
          </div>
        )}
      </div>
    );
  };

  const FollowupForm = ({ ticket, depts, onSaved }) => {
    const [resolution, setResolution] = useState("");
    const [status, setStatus] = useState(ticket.status || "0");
    const [targetDepartment, setTargetDepartment] = useState(ticket.target_department || "");
    const [sending, setSending] = useState(false);
    const [sendEmail, setSendEmail] = useState(false);
    const [emailTo, setEmailTo] = useState(() => {
      const list = [];
      if (ticket.parent_email) list.push(ticket.parent_email);
      if (ticket.department_email) list.push(ticket.department_email);
      return list.join(", ");
    });
    const [emailSubject, setEmailSubject] = useState(`Seguimiento al folio ${String(ticket.id).padStart(5, "0")}`);
    const [emailBody, setEmailBody] = useState(
      `<p>Se ha registrado un nuevo seguimiento para el folio <strong>${String(ticket.id).padStart(5, "0")}</strong>.</p>
<p><strong>Plantel:</strong> ${ticket.school_code || ticket.campus || ""}</p>
<p><strong>Padre/Madre:</strong> ${ticket.parent_name}</p>
<p><strong>Alumno:</strong> ${ticket.student_name}</p>
<p><strong>Departamento:</strong> ${targetDepartment || ticket.target_department || ticket.original_department || ""}</p>
<p><strong>Seguimiento:</strong></p>
<p>${(resolution || "").replace(/\n/g, "<br/>")}</p>`
    );
    const [error, setError] = useState("");

    const deptOptions = useMemo(() => Object.keys(depts || {}), [depts]);

    async function submitFollowup() {
      setError("");
      if (!resolution || resolution.trim().length === 0) {
        setError("Escribe el texto del seguimiento.");
        return;
      }
      setSending(true);
      try {
        const res = await fetch(`/api/tickets/${ticket.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
          body: JSON.stringify({
            resolution,
            status,
            target_department: targetDepartment || ""
          })
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          setError(data?.error || "No se pudo guardar el seguimiento.");
          setSending(false);
          return;
        }

        if (sendEmail) {
          const recipients = emailTo
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          if (recipients.length > 0) {
            const html = emailBody || `<p>${resolution.replace(/\n/g, "<br/>")}</p>`;
            const emailRes = await fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: recipients,
                subject: emailSubject || `Seguimiento al folio ${String(ticket.id).padStart(5, "0")}`,
                html
              })
            });
            if (!emailRes.ok) {
              const t = await emailRes.text();
              console.warn("[FollowupForm] email send failed", t.slice(0, 200));
            }
          }
        }

        setResolution("");
        if (typeof onSaved === "function") onSaved();
      } catch (e) {
        console.error("[FollowupForm] submit error", e);
        setError("Error de red al guardar el seguimiento.");
      }
      setSending(false);
    }

    return (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <div className="text-sm text-gray-500">
            Fecha: {new Date(ticket.fecha).toLocaleString("es-MX")}
          </div>
          <div className="text-lg font-semibold text-gray-800">
            Folio {ticket.folio_number || String(ticket.id).padStart(5, "0")}
          </div>
          <div className="flex items-center gap-3">
            {ticket.status === "1" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-green-700 text-sm">
                <Lock className="w-4 h-4" /> Cerrado
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-red-700 text-sm">
                <Pin className="w-4 h-4" /> Abierto
              </span>
            )}
            <span className="text-sm text-gray-600">
              Plantel: {ticket.school_code || ticket.campus}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="font-semibold text-gray-700">Motivo</div>
          <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">{ticket.reason}</div>
        </div>

        <div className="grid gap-2">
          <div className="font-semibold text-gray-700">Resolución inicial</div>
          <div className="rounded bg-gray-50 p-3 text-sm text-gray-700">{ticket.resolution || "—"}</div>
        </div>

        <div className="grid gap-1">
          <div className="font-semibold text-gray-800">Agregar seguimiento</div>
          <textarea
            rows={6}
            className="w-full rounded border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe el seguimiento..."
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <label className="text-sm font-medium text-gray-700">Estatus</label>
            <select
              className="rounded border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="0">Abierto</option>
              <option value="1">Cerrado</option>
            </select>
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700">Canalizar a</label>
            <select
              className="rounded border border-gray-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={targetDepartment}
              onChange={(e) => setTargetDepartment(e.target.value)}
            >
              <option value="">(Sin cambio)</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 grid gap-2 rounded border border-blue-200 bg-blue-50 p-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <span className="text-sm font-medium text-blue-900 flex items-center gap-1">
              <Mail className="w-4 h-4" /> Enviar notificación por correo
            </span>
          </label>
          {sendEmail && (
            <div className="grid gap-2">
              <div className="grid gap-1">
                <label className="text-sm text-blue-900">Para (separado por coma)</label>
                <input
                  type="text"
                  className="rounded border border-blue-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm text-blue-900">Asunto</label>
                <input
                  type="text"
                  className="rounded border border-blue-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm text-blue-900">Contenido</label>
                <textarea
                  rows={5}
                  className="rounded border border-blue-200 p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {Array.isArray(ticket.followups) && ticket.followups.length > 0 && (
          <div className="grid gap-2">
            <div className="font-semibold text-gray-800">Seguimientos ({ticket.followups.length})</div>
            <div className="grid gap-2">
              {ticket.followups.map((f, idx) => (
                <div key={`${f.id || idx}-${idx}`} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                      <CornerDownRight className="w-4 h-4" />
                      <span>{new Date(f.fecha).toLocaleString("es-MX")}</span>
                    </div>
                    <div className="text-xs rounded-full px-2 py-0.5 border border-gray-300 text-gray-700">
                      {f.target_department || "—"}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{f.resolution}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-2">
          <button
            onClick={submitFollowup}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-60"
          >
            <Check className="w-5 h-5" />
            Guardar seguimiento
          </button>
        </div>
      </div>
    );
  };

  const TicketCard = ({ ticket }) => {
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
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                    {ticket.created_by?.charAt(0) || "U"}
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
                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4" />
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
                  onClick={async () => {
                    const ticketCampus = ticket.school_code || ticket.campus || selectedCampus;
                    const depts = await fetchDepartmentsForCampus(ticketCampus);
                    setFollowDepts(depts);
                    try {
                      const res = await fetch(`/api/tickets/${ticket.id}`, { cache: "no-store" });
                      if (res.ok) {
                        const data = await res.json();
                        setFollowTicket(data);
                      } else {
                        setFollowTicket(ticket);
                      }
                    } catch {
                      setFollowTicket(ticket);
                    }
                    setFollowModalOpen(true);
                  }}
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
  };

  const TicketForm = () => {
    const [appendToExisting, setAppendToExisting] = useState(false);

    useEffect(() => {
      setAppendToExisting(Boolean(formData.existingOpenTicketId));
    }, [formData.existingOpenTicketId]);

    const originDepartments = useMemo(() => {
      const mapped = Object.keys(departments || {});
      if (mapped.length > 0) return mapped;
      return fallbackDepartmentOptions;
    }, [departments]);

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-orange-500 mb-6">
          Nueva Ficha - {campuses.find((c) => c.value === selectedCampus)?.label}
        </h2>

        <StudentSearch />

        {formData.existingOpenTicketId && (
          <div className="mb-4 p-4 rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-900">
            Se detectó una ficha abierta para este padre/madre. Folio:{" "}
            <strong>{String(formData.existingOpenTicketId).padStart(5, "0")}</strong>. Puedes
            agregar un seguimiento a ese folio o crear una nueva ficha.
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={appendToExisting}
                  onChange={(e) => {
                    setAppendToExisting(e.target.checked);
                    setFormData((prev) => ({ ...prev, appendToExisting: e.target.checked }));
                  }}
                />
                Agregar seguimiento al folio existente
              </label>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Nombre del Padre/Madre/Tutor</label>
            <input
              type="text"
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.parentName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, parentName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Alumno</label>
            <input
              type="text"
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.studentName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, studentName: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Teléfono</label>
            <input
              type="tel"
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.phoneNumber}
              onChange={(e) =>
                setFormData((p) => ({ ...p, phoneNumber: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Correo</label>
            <input
              type="email"
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.parentEmail}
              onChange={(e) =>
                setFormData((p) => ({ ...p, parentEmail: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Motivo</label>
            <textarea
              rows={4}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.reason}
              onChange={(e) =>
                setFormData((p) => ({ ...p, reason: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3 md:col-span-2">
            <label className="text-sm font-semibold text-gray-700">Resolución / Acción inicial</label>
            <textarea
              rows={4}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.resolution}
              onChange={(e) =>
                setFormData((p) => ({ ...p, resolution: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Medio de contacto</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.contactMethod}
              onChange={(e) =>
                setFormData((p) => ({ ...p, contactMethod: e.target.value }))
              }
            >
              <option value="email">Correo</option>
              <option value="llamada">Llamada telefónica</option>
              <option value="mensaje">Mensaje</option>
              <option value="videollamada">Videollamada</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="teams">Microsoft Teams</option>
              <option value="zoom">Zoom</option>
              <option value="presencial">Presencial</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-gray-700">Cita</label>
            <div className="flex items-center gap-3">
              <input
                type="datetime-local"
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                value={formData.appointmentDate}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, appointmentDate: e.target.value }))
                }
                disabled={formData.noAppointment}
              />
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={formData.noAppointment}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      noAppointment: e.target.checked,
                      appointmentDate: e.target.checked ? "" : (p.appointmentDate || new Date().toISOString().slice(0, 16)),
                    }))
                  }
                />
                Sin cita
              </label>
            </div>
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Departamento de origen</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.selectedDepartment}
              onChange={(e) =>
                setFormData((p) => ({ ...p, selectedDepartment: e.target.value }))
              }
            >
              {originDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Canalizar a</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.targetDepartment}
              onChange={(e) =>
                setFormData((p) => ({ ...p, targetDepartment: e.target.value }))
              }
            >
              <option value="">Sin canalización</option>
              {Object.keys(departments).map((d) => {
                const holder = holderDisplayFor(d);
                const label = holder ? `${d} — ${holder}` : d;
                return (
                  <option key={d} value={d}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">Estatus</label>
            <select
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={formData.status}
              onChange={(e) =>
                setFormData((p) => ({ ...p, status: e.target.value }))
              }
            >
              <option value="0">Abierto</option>
              <option value="1">Cerrado</option>
            </select>
          </div>
          <div className="grid gap-3">
            <label className="text-sm font-semibold text-gray-700">¿Es queja?</label>
            <div className="flex items-center gap-2">
              <input
                id="isComplaint"
                type="checkbox"
                className="h-4 w-4"
                checked={formData.isComplaint}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, isComplaint: e.target.checked }))
                }
              />
              <label htmlFor="isComplaint" className="text-sm text-gray-700">
                Marcar como queja
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => {
              setFormData((prev) => ({ ...prev, appendToExisting }));
              setTimeout(submitTicket, 0);
            }}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {appendToExisting && formData.existingOpenTicketId ? "Agregar Seguimiento" : "Guardar Ficha"}
          </button>
        </div>
      </div>
    );
  };

  // Manual dashboard fetch: requires user action
  const Dashboard = () => {
    const [inflight, setInflight] = useState(false);

    const months = useMemo(() => {
      if (!dashSchoolYear) return [];
      const [startYear, endYear] = dashSchoolYear.split("-").map(Number);
      const arr = [];
      for (let m = 7; m < 12; m++) {
        const date = new Date(startYear, m, 1);
        arr.push({
          value: `${startYear}-${String(m + 1).padStart(2, "0")}`,
          label: date.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
        });
      }
      for (let m = 0; m < 7; m++) {
        const date = new Date(endYear, m, 1);
        arr.push({
          value: `${endYear}-${String(m + 1).padStart(2, "0")}`,
          label: date.toLocaleDateString("es-MX", { month: "long", year: "numeric" }),
        });
      }
      return arr;
    }, [dashSchoolYear]);

    const buildQS = useCallback(() => {
      let qs = `campus=${encodeURIComponent(selectedCampus)}`;
      if (dashStatusFilter !== undefined && dashStatusFilter !== null) {
        qs += `&status=${encodeURIComponent(dashStatusFilter)}`;
      }
      if (dashShowAllOpen && dashStatusFilter === "0") {
        qs += `&showAllOpen=true`;
      } else if (dashSelectedMonth) {
        qs += `&month=${encodeURIComponent(dashSelectedMonth)}`;
      } else if (dashSchoolYear) {
        qs += `&schoolYear=${encodeURIComponent(dashSchoolYear)}`;
      }
      return qs;
    }, [selectedCampus, dashStatusFilter, dashShowAllOpen, dashSelectedMonth, dashSchoolYear]);

    async function fetchDashboard() {
      if (inflight) return;
      setInflight(true);
      setKpiLoading(true);
      setDashLoadError("");
      try {
        const url = `/api/dashboard?${buildQS()}`;
        console.log("[Dashboard] manual fetch", { url });
        const res = await fetch(url, { cache: "no-store", headers: { "x-client": "sapf-app" } });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          console.warn("[Dashboard] not ok", res.status, t.slice(0, 200));
          setTickets([]);
          setDashLoadError("No se pudo cargar la información.");
          setKpiLoading(false);
          setInflight(false);
          return;
        }
        const data = await res.json();
        setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
        if (data?.kpi) {
          const next = {
            total: Number(data.kpi.total || 0),
            abiertos: Number(data.kpi.abiertos || 0),
            cerrados: Number(data.kpi.cerrados || 0),
            quejas: Number(data.kpi.quejas || 0),
            avg_resolucion_horas: data.kpi.avg_resolucion_horas !== null ? Number(data.kpi.avg_resolucion_horas) : null,
          };
          lastGoodKpiRef.current = next;
          setKpi(next);
        }
        setDashLastLoadedAt(new Date());
      } catch (e) {
        console.error("[Dashboard] fetch error", e);
        setDashLoadError("Error de red.");
        setTickets([]);
      }
      setKpiLoading(false);
      setInflight(false);
    }

    async function fetchDistribution() {
      setDistLoading(true);
      try {
        let distUrl = `/api/stats/distribution?campus=${encodeURIComponent(selectedCampus)}`;
        if (!(dashShowAllOpen && dashStatusFilter === "0")) {
          if (dashSelectedMonth) {
            distUrl += `&month=${encodeURIComponent(dashSelectedMonth)}`;
          } else if (dashSchoolYear) {
            distUrl += `&schoolYear=${encodeURIComponent(dashSchoolYear)}`;
          }
        }
        console.log("[Dashboard] manual fetch distribution", { distUrl });
        const res = await fetch(distUrl, { cache: "no-store", headers: { "x-client": "sapf-app" } });
        const data = await res.json();
        setDistStats(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching distribution stats:", err);
      }
      setDistLoading(false);
    }

    const filteredTickets = tickets;

    return (
      <div className="p-6">
        <h1 className="text-4xl font-bold text-center text-orange-500 mb-8">
          Mapa de Seguimiento de Fichas
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <div className="flex flex-col lg:flex-row lg:flex-wrap gap-4 mb-6">
            <div className="flex items-center gap-3">
              <label className="font-semibold text-gray-700">Plantel:</label>
              <select
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-64"
                value={selectedCampus}
                onChange={(e) => setSelectedCampus(e.target.value)}
              >
                {campuses.map((campus) => (
                  <option key={campus.value} value={campus.value}>
                    {campus.label}
                  </option>
                ))}
              </select>
            </div>

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
                <option value="">Todos</option>
                {months.map((month) => (
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
                  dashStatusFilter === "0"
                    ? "border-red-500 bg-red-50"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  checked={dashStatusFilter === "0"}
                  onChange={() => setDashStatusFilter("0")}
                  className="text-red-600"
                />
                <Pin className="w-5 h-5 text-red-500" />
                <span className="font-medium">
                  Abiertos ({filteredTickets.length})
                </span>
              </label>
              <label
                className={`flex items-center gap-2 cursor-pointer px-4 py-2 border-2 rounded-lg transition-colors ${
                  dashStatusFilter === "1"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  checked={dashStatusFilter === "1"}
                  onChange={() => setDashStatusFilter("1")}
                  className="text-green-600"
                />
                <Lock className="w-5 h-5 text-green-500" />
                <span className="font-medium">Cerrados</span>
              </label>
            </div>

            {dashStatusFilter === "0" && (
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border-2 border-blue-500 bg-blue-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={dashShowAllOpen}
                  onChange={(e) => setDashShowAllOpen(e.target.checked)}
                  className="text-blue-600"
                />
                <span className="font-medium text-blue-700">
                  Ver todos los abiertos
                </span>
              </label>
            )}

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await fetchDashboard();
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 shadow transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${inflight ? "animate-spin" : ""}`} />
                Cargar/Actualizar
              </button>
              <button
                onClick={() => setShowStats((s) => !s)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 shadow transition-all"
              >
                <BarChart3 className="w-5 h-5" />
                {showStats ? "Ocultar Estadísticas" : "Estadísticas"}
              </button>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 shadow transition-all"
              >
                <Download className="w-5 h-5" />
                Exportar Excel
              </button>
              <a
                href="/compare"
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 shadow transition-all"
              >
                <TrendingUp className="w-5 h-5" />
                Comparar planteles
              </a>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <span className="font-semibold">Filtros:</span>
            {dashSelectedMonth
              ? ` Mes: ${months.find((m) => m.value === dashSelectedMonth)?.label}`
              : ` Ciclo: ${dashSchoolYear}`}
            {dashLastLoadedAt && (
              <span className="ml-3 text-blue-700">
                Última carga: {dashLastLoadedAt.toLocaleString("es-MX")}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              Total {kpiLoading && <span className="inline-block h-2 w-2 rounded-full bg-orange-400 animate-pulse" aria-label="Cargando" />}
            </div>
            <div className="text-3xl font-bold text-orange-600">{(lastGoodKpiRef.current?.total ?? kpi.total)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <div className="text-sm text-gray-600">Abiertos</div>
            <div className="text-3xl font-bold text-red-600">{(lastGoodKpiRef.current?.abiertos ?? kpi.abiertos)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="text-sm text-gray-600">Cerrados</div>
            <div className="text-3xl font-bold text-green-600">{(lastGoodKpiRef.current?.cerrados ?? kpi.cerrados)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
            <div className="text-sm text-gray-600">Tiempo prom. cierre</div>
            <div className="text-2xl font-bold text-purple-600">
              {((lastGoodKpiRef.current?.avg_resolucion_horas ?? kpi.avg_resolucion_horas) !== null)
                ? `${(lastGoodKpiRef.current?.avg_resolucion_horas ?? kpi.avg_resolucion_horas).toFixed(1)} h`
                : "—"}
            </div>
          </div>
        </div>

        {showStats && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800">Distribución por Departamento</h3>
              <button
                onClick={fetchDistribution}
                className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 flex items-center gap-2"
              >
                <BarChart3 className={`w-4 h-4 ${distLoading ? "animate-pulse" : ""}`} />
                {distLoading ? "Cargando..." : "Cargar estadísticas"}
              </button>
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
                No hay datos. Presiona "Cargar estadísticas".
              </div>
            )}
          </div>
        )}

        {dashLoadError ? (
          <div className="text-center py-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {dashLoadError}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No hay fichas {dashStatusFilter === "0" ? "abiertas" : "cerradas"}
              {dashShowAllOpen ? " en este plantel" : " con los filtros seleccionados"} — usa "Cargar/Actualizar" para consultar.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const DepartmentManager = () => {
    const [editData, setEditData] = useState({});

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-orange-500">
            Configuración de Departamentos -{" "}
            {campuses.find((c) => c.value === selectedCampus)?.label}
          </h2>
        </div>

        <div className="grid gap-4">
          {Object.entries(departments).map(([deptName, deptData]) => (
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
                        <label className="text-sm text-gray-600">
                          Email del departamento
                        </label>
                        <input
                          type="email"
                          placeholder="Email del departamento"
                          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                          defaultValue={deptData[0]?.email}
                          onChange={(e) =>
                            setEditData({ ...editData, email: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">
                          Email del supervisor
                        </label>
                        <input
                          type="email"
                          placeholder="Email del supervisor"
                          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                          defaultValue={deptData[0]?.supervisor_email}
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
                            updateDepartment(
                              deptName,
                              editData.email || deptData[0]?.email,
                              editData.supervisor ||
                                deptData[0]?.supervisor_email
                            )
                          }
                          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Guardar
                        </button>
                        <button
                          onClick={() => setEditingDept(null)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      <div className="mb-2">
                        <span className="font-medium">Email:</span>{" "}
                        {deptData[0]?.email}
                      </div>
                      <div>
                        <span className="font-medium">Supervisor:</span>{" "}
                        {deptData[0]?.supervisor_email}
                      </div>
                    </div>
                  )}
                </div>
                {!editingDept && (
                  <button
                    onClick={() => setEditingDept(deptName)}
                    className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-3xl font-bold">SAPF - Sistema de Atención</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentView("dashboard")}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${
                  currentView === "dashboard"
                    ? "bg-white text-orange-500 shadow-lg"
                    : "hover:bg-orange-400"
                }`}
              >
                <TrendingUp className="inline w-5 h-5 mr-2" />
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView("form")}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${
                  currentView === "form"
                    ? "bg-white text-orange-500 shadow-lg"
                    : "hover:bg-orange-400"
                }`}
              >
                <FileText className="inline w-5 h-5 mr-2" />
                Nueva Ficha
              </button>
              <button
                onClick={() => setCurrentView("departments")}
                className={`px-5 py-2 rounded-lg font-medium transition-all ${
                  currentView === "departments"
                    ? "bg-white text-orange-500 shadow-lg"
                    : "hover:bg-orange-400"
                }`}
              >
                <Users className="inline w-5 h-5 mr-2" />
                Departamentos
              </button>
              <a
                href="/compare"
                className="px-5 py-2 rounded-lg font-medium transition-all hover:bg-orange-400"
              >
                <TrendingUp className="inline w-5 h-5 mr-2" />
                Comparar Planteles
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto py-8 px-4">
        <div className="mb-4"></div>

        {currentView === "dashboard" && <Dashboard />}
        {currentView === "form" && <TicketForm />}
        {currentView === "departments" && <DepartmentManager />}
      </main>

      <Overlay
        open={followModalOpen}
        onClose={() => setFollowModalOpen(false)}
        title="Seguimiento de ficha"
      >
        {followTicket ? (
          <FollowupForm
            ticket={followTicket}
            depts={followDepts}
            onSaved={async () => {
              try {
                const res = await fetch(`/api/tickets/${followTicket.id}`, { cache: "no-store" });
                if (res.ok) {
                  const data = await res.json();
                  setFollowTicket(data);
                }
              } catch { /* ignore */ }
              // Inform user they can refresh manually
              refreshTicketsAndKpi();
            }}
          />
        ) : (
          <div className="text-gray-600">Cargando ficha…</div>
        )}
      </Overlay>
    </div>
  );
}

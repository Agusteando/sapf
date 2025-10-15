
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
  CornerDownRight,
  Stethoscope,
  Plus,
  X,
  Loader2
} from "lucide-react";
import Overlay from "@/components/overlay";

// Global activity progress bar
function TopActivityBar({ active }) {
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 h-1 ${active ? "opacity-100" : "opacity-0"} transition-opacity`}>
      <div className="h-1 bg-gradient-to-r from-orange-500 via-fuchsia-500 to-emerald-500 animate-[progress_1.2s_linear_infinite]" />
      <style jsx>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function displayLabel(email, name) {
  const e = String(email || "");
  const n = String(name || "").trim();
  if (n) return `${n} <${e}>`;
  return e;
}

// Email chips component with name-aware suggestions
function EmailChips({ value, onChange, suggestions = [] }) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const addEmail = (email) => {
    const cleaned = String(email || "").trim().toLowerCase();
    if (!cleaned) return;
    const next = Array.from(new Set([...(value || []), cleaned]));
    onChange?.(next);
    setInput("");
    setOpen(false);
  };
  const removeEmail = (email) => {
    const cleaned = String(email || "").trim().toLowerCase();
    const next = (value || []).filter((e) => e.toLowerCase() !== cleaned);
    onChange?.(next);
  };

  const filtered = useMemo(() => {
    const arr = Array.isArray(suggestions) ? suggestions : [];
    if (!input) return arr;
    const q = input.toLowerCase();
    return arr.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q));
  }, [input, suggestions]);

  const resolveSuggestion = (email) => {
    const e = String(email || "").toLowerCase();
    return (suggestions || []).find((s) => String(s.email || "").toLowerCase() === e) || null;
    };
  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 items-center rounded border border-blue-200 bg-blue-50 p-2">
        {(value || []).map((email) => {
          const sug = resolveSuggestion(email);
          return (
            <span key={email} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-blue-600 text-white text-xs">
              <span className="font-medium">{sug?.name || email}</span>
              <span className="opacity-80">&lt;{email}&gt;</span>
              <button onClick={() => removeEmail(email)} className="ml-1 hover:text-blue-200" aria-label="Quitar">
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        <input
          type="email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Agregar correo (interno)"
          className="flex-1 bg-transparent outline-none text-sm p-1"
        />
        <button
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
          onClick={() => input && addEmail(input)}
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded border border-blue-200 bg-white shadow">
          {filtered.map((s) => (
            <div
              key={s.email}
              className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer flex items-center gap-2"
              onClick={() => addEmail(s.email)}
            >
              <span className="font-medium">{s.name || s.email}</span>
              <span className="text-gray-500">&lt;{s.email}&gt;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Student search with lazy photo
function SearchStudent({ students, onSelected, placeholder = "Buscar estudiante o padre (mínimo 3 caracteres)..." }) {
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

export default function ParentAttentionSystem() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedCampus, setSelectedCampus] = useState("PMB");
  const [tickets, setTickets] = useState([]);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState({});
  const [editingDept, setEditingDept] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [defaultSchoolYear, setDefaultSchoolYear] = useState("");

  // Global activity tracker
  const [activeOps, setActiveOps] = useState(0);
  const trackAsync = useCallback(async (fn) => {
    setActiveOps((n) => n + 1);
    try {
      return await fn();
    } finally {
      setActiveOps((n) => Math.max(0, n - 1));
    }
  }, []);

  // KPIs and dashboard
  const [kpi, setKpi] = useState({ total: 0, abiertos: 0, cerrados: 0, quejas: 0, avg_resolucion_horas: null });
  const [kpiLoading, setKpiLoading] = useState(false);
  const lastGoodKpiRef = useRef(null);

  // Modals and followups
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followTicket, setFollowTicket] = useState(null);
  const [followDepts, setFollowDepts] = useState({});

  // Forms
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
    studentPhotoUrl: "",
    ccEmails: []
  });

  // Dashboard state
  const [dashStatusFilter, setDashStatusFilter] = useState("0");
  const [dashSchoolYear, setDashSchoolYear] = useState("");
  const [dashSelectedMonth, setDashSelectedMonth] = useState("");
  const [dashLastLoadedAt, setDashLastLoadedAt] = useState(null);
  const [dashLoadError, setDashLoadError] = useState("");

  // Stats
  const [showStats, setShowStats] = useState(false);
  const [distStats, setDistStats] = useState([]);
  const [distLoading, setDistLoading] = useState(false);

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
    "Enfermería"
  ];

  // Load school years
  useEffect(() => {
    let mounted = true;
    trackAsync(async () => {
      try {
        const r = await fetch("/api/stats/school-years", { cache: "no-store" });
        if (!mounted) return;
        if (!r.ok) throw new Error("school-years not ok");
        const data = await r.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setSchoolYears(items);
        setDefaultSchoolYear(data?.default || items[0] || "");
        setDashSchoolYear((prev) => prev || data?.default || items[0] || "");
      } catch (e) {
        console.warn("[app/page] failed to fetch school years", e);
        const now = new Date();
        const y = now.getFullYear();
        const base = now.getMonth() >= 7 ? y : y - 1;
        const fallback = [];
        for (let i = 0; i < 6; i++) fallback.push(`${base - i}-${base - i + 1}`);
        setSchoolYears(fallback);
        setDefaultSchoolYear(fallback[0]);
        setDashSchoolYear((prev) => prev || fallback[0]);
      }
    });
    return () => { mounted = false; };
  }, [trackAsync]);

  // Fetch students by campus
  const fetchStudentData = useCallback(async (campus) => {
    await trackAsync(async () => {
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
    });
  }, [trackAsync]);

  function chooseDefaultOriginDepartment(grouped) {
    const names = Object.keys(grouped);
    if (names.length === 0) return "Enfermería";
    const priority = [
      "Control Escolar",
      "Dirección",
      "Administración",
      "Psicología",
      "Pedagogía Español",
      "Pedagogía Inglés",
      "Enfermería"
    ];
    for (const p of priority) {
      if (names.includes(p)) return p;
    }
    return names.sort((a, b) => a.localeCompare(b, "es"))[0];
  }

  // Fetch departments for campus, enriched with display names
  const fetchDepartments = useCallback(async () => {
    await trackAsync(async () => {
      try {
        const response = await fetch(`/api/departments/${selectedCampus}`, { cache: "no-store", headers: { "x-client": "sapf-app" } });
        if (!response.ok) {
          setDepartments({ Enfermería: [{ email: "", supervisor_email: "", campus: selectedCampus, department_name: "Enfermería" }] });
          setFormData((prev) => ({
            ...prev,
            selectedDepartment: prev.selectedDepartment || "Enfermería",
          }));
          return;
        }
        const data = await response.json();
        const grouped = (Array.isArray(data) ? data : []).reduce((acc, dept) => {
          if (!acc[dept.department_name]) acc[dept.department_name] = [];
          acc[dept.department_name].push(dept);
          return acc;
        }, {});
        if (!grouped["Enfermería"]) {
          grouped["Enfermería"] = [{ email: "", supervisor_email: "", campus: selectedCampus, department_name: "Enfermería" }];
        }
        setDepartments(grouped);
        setFormData((prev) => {
          const current = prev.selectedDepartment;
          const available = Object.keys(grouped);
          let next = current;
          if (!current || !available.includes(current)) {
            next = chooseDefaultOriginDepartment(grouped) || "Enfermería";
          }
          return { ...prev, selectedDepartment: next };
        });
      } catch (error) {
        console.error("Error fetching departments:", error);
        setDepartments({ Enfermería: [{ email: "", supervisor_email: "", campus: selectedCampus, department_name: "Enfermería" }] });
      }
    });
  }, [selectedCampus, trackAsync]);

  const fetchDepartmentsForCampus = useCallback(async (campusCode) => {
    return trackAsync(async () => {
      try {
        const response = await fetch(`/api/departments/${encodeURIComponent(campusCode)}`, { cache: "no-store", headers: { "x-client": "sapf-app" } });
        if (!response.ok) return { Enfermería: [{ email: "", supervisor_email: "", campus: campusCode, department_name: "Enfermería" }] };
        const data = await response.json();
        const grouped = (Array.isArray(data) ? data : []).reduce((acc, dept) => {
          if (!acc[dept.department_name]) acc[dept.department_name] = [];
          acc[dept.department_name].push(dept);
          return acc;
        }, {});
        if (!grouped["Enfermería"]) {
          grouped["Enfermería"] = [{ email: "", supervisor_email: "", campus: campusCode, department_name: "Enfermería" }];
        }
        return grouped;
      } catch (e) {
        console.warn("[app/page] fetchDepartmentsForCampus error", e);
        return { Enfermería: [{ email: "", supervisor_email: "", campus: campusCode, department_name: "Enfermería" }] };
      }
    });
  }, [trackAsync]);

  // Load students/departments when entering relevant views or plantel changes
  useEffect(() => {
    if (currentView === "form" || currentView === "nursing") {
      fetchStudentData(selectedCampus);
    }
    if (currentView === "form" || currentView === "departments") {
      fetchDepartments();
    }
  }, [currentView, selectedCampus, fetchStudentData, fetchDepartments]);

  const checkDuplicate = async (parentName) => {
    if (!parentName || parentName.length < 3) return null;
    return trackAsync(async () => {
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
    });
  };

  // Suggestions compiled from departments (email and supervisor), enriched with names from departments API
  const internalEmailSuggestions = useMemo(() => {
    const list = [];
    for (const [_, arr] of Object.entries(departments || {})) {
      for (const r of arr) {
        if (r?.email) list.push({ email: r.email, name: r.email_display_name || "" });
        if (r?.supervisor_email) list.push({ email: r.supervisor_email, name: r.supervisor_display_name || "" });
      }
    }
    // de-dup by email
    const map = new Map();
    for (const item of list) {
      const key = String(item.email || "").toLowerCase();
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  }, [departments]);

  // Compute default month for a given school year: current month if it belongs to that cycle; otherwise August (start)
  const defaultMonthForSchoolYear = useCallback((sy) => {
    try {
      const [startYearStr, endYearStr] = String(sy || "").split("-");
      const startYear = parseInt(startYearStr, 10);
      const endYear = parseInt(endYearStr, 10);
      if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return "";

      const now = new Date();
      const nowY = now.getFullYear();
      const nowM = now.getMonth(); // 0-based
      // School year runs Aug (7) to July (6) of next year
      const inFirstSpan = nowY === startYear && nowM >= 7; // Aug-Dec of startYear
      const inSecondSpan = nowY === endYear && nowM <= 6;   // Jan-Jul of endYear

      if (inFirstSpan || inSecondSpan) {
        // Build yyyy-mm from current date while clamping into cycle's year
        const yyyy = inFirstSpan ? startYear : endYear;
        const mm = String(nowM + 1).padStart(2, "0");
        return `${yyyy}-${mm}`;
      }
      // Fallback to August of start year
      return `${startYear}-08`;
    } catch {
      return "";
    }
  }, []);

  // Ensure dashSelectedMonth is set to a valid month for the currently selected school year
  useEffect(() => {
    if (!dashSchoolYear) return;
    setDashSelectedMonth((prev) => {
      if (prev) return prev;
      return defaultMonthForSchoolYear(dashSchoolYear);
    });
  }, [dashSchoolYear, defaultMonthForSchoolYear]);

  const monthsForSchoolYear = useMemo(() => {
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

  const buildDashboardQS = useCallback(() => {
    let qs = `campus=${encodeURIComponent(selectedCampus)}`;
    if (dashStatusFilter !== undefined && dashStatusFilter !== null) {
      qs += `&status=${encodeURIComponent(dashStatusFilter)}`;
    }
    if (dashSelectedMonth) {
      qs += `&month=${encodeURIComponent(dashSelectedMonth)}`;
    } else if (dashSchoolYear) {
      qs += `&schoolYear=${encodeURIComponent(dashSchoolYear)}`;
    }
    return qs;
  }, [selectedCampus, dashStatusFilter, dashSelectedMonth, dashSchoolYear]);

  useEffect(() => {
    let abort = false;
    async function fetchDashboard() {
      setKpiLoading(true);
      setDashLoadError("");
      await trackAsync(async () => {
        try {
          const url = `/api/dashboard?${buildDashboardQS()}`;
          const res = await fetch(url, { cache: "no-store", headers: { "x-client": "sapf-app" } });
          if (abort) return;
          if (res.status === 204) {
            setKpiLoading(false);
            return;
          }
          if (!res.ok) {
            const t = await res.text().catch(() => "");
            console.warn("[Dashboard] not ok", res.status, t.slice(0, 200));
            setTickets([]);
            setDashLoadError("No se pudo cargar la información.");
            setKpiLoading(false);
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
          if (!abort) {
            console.error("[Dashboard] fetch error", e);
            setDashLoadError("Error de red.");
            setTickets([]);
          }
        }
        if (!abort) setKpiLoading(false);
      });
    }
    if (currentView === "dashboard") {
      fetchDashboard();
    }
    return () => { abort = true; };
  }, [currentView, selectedCampus, dashStatusFilter, dashSelectedMonth, dashSchoolYear, buildDashboardQS, trackAsync]);

  useEffect(() => {
    let abort = false;
    async function fetchDistribution() {
      setDistLoading(true);
      await trackAsync(async () => {
        try {
          let distUrl = `/api/stats/distribution?campus=${encodeURIComponent(selectedCampus)}`;
          if (dashSelectedMonth) {
            distUrl += `&month=${encodeURIComponent(dashSelectedMonth)}`;
          } else if (dashSchoolYear) {
            distUrl += `&schoolYear=${encodeURIComponent(dashSchoolYear)}`;
          }
          const res = await fetch(distUrl, { cache: "no-store", headers: { "x-client": "sapf-app" } });
          if (abort) return;
          const data = await res.json();
          setDistStats(Array.isArray(data) ? data : []);
        } catch (err) {
          if (!abort) console.error("Error fetching distribution stats:", err);
        }
        if (!abort) setDistLoading(false);
      });
    }
    if (currentView === "dashboard" && showStats) {
      fetchDistribution();
    }
    return () => { abort = true; };
  }, [currentView, showStats, selectedCampus, dashSelectedMonth, dashSchoolYear, trackAsync]);

  // Export current month range to Excel
  function computeMonthRange(yyyyMm) {
    if (!/^\d{4}-\d{2}$/.test(String(yyyyMm || ""))) return null;
    const [yStr, mStr] = yyyyMm.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const start = new Date(y, m, 1, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59); // last day 23:59:59
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")} 00:00:00`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")} 23:59:59`,
    };
  }

  const exportToExcel = () => {
    const base = `/api/export-excel?campus=${encodeURIComponent(selectedCampus)}&status=`;
    const r = computeMonthRange(dashSelectedMonth);
    if (r) {
      window.open(`${base}&startDate=${encodeURIComponent(r.start)}&endDate=${encodeURIComponent(r.end)}`, "_blank");
    } else if (dashSchoolYear) {
      // fallback to full school year
      const [startYear, endYear] = dashSchoolYear.split("-").map(Number);
      const start = `${startYear}-08-01 00:00:00`;
      const end = `${endYear}-08-01 00:00:00`;
      window.open(`${base}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`, "_blank");
    } else {
      window.open(base, "_blank");
    }
  };

  function holderDisplayFor(deptName) {
    const entry = departments?.[deptName]?.[0] || {};
    const name =
      entry.responsable_name ||
      entry.display_name ||
      entry.in_charge_name ||
      entry.incharge_name ||
      entry.owner_name ||
      entry.supervisor_name ||
      entry.name ||
      entry.full_name ||
      entry.supervisor_display_name ||
      entry.email_display_name ||
      "";
    const email = entry.email || "";
    const label = displayLabel(email, name);
    return label;
  }

  const FollowupForm = ({ ticket, depts, onSaved }) => {
    const [resolution, setResolution] = useState("");
    const [status, setStatus] = useState(ticket.status || "0");
    const [targetDepartment, setTargetDepartment] = useState(ticket.target_department || ticket.original_department || "");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [ccEmails, setCcEmails] = useState([]);

    const deptOptions = useMemo(() => Object.keys(depts || {}), [depts]);

    const deptRec = depts?.[targetDepartment]?.[0] || {};
    const deptEmail = deptRec.email || "";
    const deptName = deptRec.email_display_name || "";
    const supEmail = deptRec.supervisor_email || "";
    const supName = deptRec.supervisor_display_name || "";

    async function submitFollowup() {
      setError("");
      if (!resolution || resolution.trim().length === 0) {
        setError("Escribe el texto del seguimiento.");
        return;
      }
      setSending(true);
      await trackAsync(async () => {
        try {
          const res = await fetch(`/api/tickets/${ticket.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
            body: JSON.stringify({
              resolution,
              status,
              target_department: targetDepartment || "",
              cc_emails: ccEmails
            })
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            setError(data?.error || "No se pudo guardar el seguimiento.");
            setSending(false);
            return;
          }
          setResolution("");
          setCcEmails([]);
          if (typeof onSaved === "function") onSaved();
        } catch (e) {
          console.error("[FollowupForm] submit error", e);
          setError("Error de red al guardar el seguimiento.");
        }
        setSending(false);
      });
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

        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Un correo será enviado a: <strong>{displayLabel(deptEmail, deptName) || "—"}</strong>
          {supEmail ? <> y copia a su supervisor: <strong>{displayLabel(supEmail, supName)}</strong></> : <> (sin supervisor configurado)</>}
          <div className="mt-2">
            Correos adicionales (internos):
            <EmailChips value={ccEmails} onChange={setCcEmails} suggestions={
              Object.values(depts || {}).flat().map((r) => ({
                email: r.email,
                name: r.email_display_name || ""
              })).concat(
                Object.values(depts || {}).flat().map((r) => ({
                  email: r.supervisor_email,
                  name: r.supervisor_display_name || ""
                }))
              ).filter((x) => x.email)
            } />
          </div>
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
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
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
                    await trackAsync(async () => {
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
                    });
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
    const [duplicate, setDuplicate] = useState(null);

    useEffect(() => {
      setAppendToExisting(Boolean(formData.existingOpenTicketId));
    }, [formData.existingOpenTicketId]);

    const originDepartments = useMemo(() => {
      const mapped = Object.keys(departments || {});
      if (mapped.length > 0) return mapped;
      return fallbackDepartmentOptions;
    }, [departments]);

    // Mandatory recipients preview when canalizing
    const canalizadoRec = departments[formData.targetDepartment]?.[0] || {};
    const canalizadoEmail = canalizadoRec.email || "";
    const canalizadoName = canalizadoRec.email_display_name || "";
    const canalizadoSup = canalizadoRec.supervisor_email || "";
    const canalizadoSupName = canalizadoRec.supervisor_display_name || "";

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-orange-500">
            Nueva Ficha - {campuses.find((c) => c.value === selectedCampus)?.label}
          </h2>
          {formData.studentPhotoUrl ? (
            <div className="relative w-16 h-16 rounded-full ring-4 ring-orange-300 overflow-hidden">
              <img src={formData.studentPhotoUrl} alt="Alumno" loading="lazy" className="w-full h-full object-cover" />
            </div>
          ) : null}
        </div>

        <SearchStudent
          students={students}
          onSelected={async (student) => {
            const parentName = student.nombre_padre
              ? `${student.nombre_padre} ${student.apellido_paterno_padre ?? ""}`.trim()
              : "";

            setFormData((prev) => ({
              ...prev,
              studentName: `${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim(),
              parentName,
              phoneNumber: student.telefono_padre || student.telefono_madre || "",
              parentEmail: student.email_padre || student.email_madre || "",
              studentPhotoUrl: student?.matricula?.foto || ""
            }));

            const dup = await checkDuplicate(parentName);
            setDuplicate(dup);
            setFormData((prev) => ({
              ...prev,
              existingOpenTicketId: dup?.dup === 1 ? dup?.id : null,
              appendToExisting: dup?.dup === 1 ? true : prev.appendToExisting,
            }));
          }}
        />

        {duplicate && duplicate.dup === 1 && (
          <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700">
              Ya existe un folio abierto para {formData.parentName}. Folio:{" "}
              {String(duplicate.id).padStart(5, "0")} — se agregará seguimiento por defecto.
            </span>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 mt-4">
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
                const entry = departments[d]?.[0] || {};
                const label = displayLabel(entry.email || "", entry.email_display_name || "") || d;
                return (
                  <option key={d} value={d}>
                    {d} {entry.email ? `— ${label}` : ""}
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
          <div className="grid gap-3 md:col-span-2">
            <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              {formData.targetDepartment ? (
                <>
                  Un correo será enviado a: <strong>{displayLabel(canalizadoEmail, canalizadoName) || "—"}</strong>
                  {canalizadoSup ? <> y copia al supervisor: <strong>{displayLabel(canalizadoSup, canalizadoSupName)}</strong></> : <> (sin supervisor configurado)</>}
                  <div className="mt-2">
                    Correos adicionales (internos):
                    <EmailChips
                      value={formData.ccEmails}
                      onChange={(next) => setFormData((p) => ({ ...p, ccEmails: next }))}
                      suggestions={internalEmailSuggestions}
                    />
                  </div>
                </>
              ) : (
                <>No hay canalización seleccionada. Si canalizas, se notificará automáticamente al departamento y su supervisor.</>
              )}
            </div>
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
            onClick={submitTicket}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center gap-2"
          >
            {activeOps > 0 ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            Guardar Ficha
          </button>
        </div>
      </div>
    );
  };

  // Nursing Report Form (only section allowed to email parents; automatic sending)
  const NursingReport = () => {
    const [parentName, setParentName] = useState("");
    const [parentEmail, setParentEmail] = useState("");
    const [studentName, setStudentName] = useState("");
    const [report, setReport] = useState("");
    const [actions, setActions] = useState("");
    const [sending, setSending] = useState(false);
    const [studentPhoto, setStudentPhoto] = useState("");

    async function submitNursingReport() {
      if (!parentName || !parentEmail || !studentName || !report) {
        alert("Completa los campos requeridos (Padre/Madre, Correo, Alumno, Reporte).");
        return;
      }
      setSending(true);
      await trackAsync(async () => {
        try {
          // Store in DB
          const createRes = await fetch("/api/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
            body: JSON.stringify({
              campus: selectedCampus,
              contact_method: "nursing",
              is_complaint: 0,
              parent_name: parentName,
              student_name: studentName,
              phone_number: "",
              parent_email: parentEmail,
              reason: `Reporte de Enfermería`,
              resolution: actions || report,
              appointment_date: null,
              target_department: "",
              department_email: "",
              created_by: "Enfermería",
              original_department: "Reporte de Enfermería",
              status: "1"
            })
          });
          const created = await createRes.json();

          if (!createRes.ok || !created?.success) {
            alert(created?.error || "No se pudo registrar el reporte.");
            setSending(false);
            return;
          }

          const folio = created.folioNumber || String(created.ticketId).padStart(5, "0");
          const subject = `Reporte de Enfermería — Folio ${folio}`;
          const html = `
          <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
              ${studentPhoto ? `<img src="${studentPhoto}" alt="${studentName}" style="width:56px;height:56px;border-radius:9999px;object-fit:cover;border:3px solid #10b981;" />` : ""}
              <h2 style="color:#065f46;margin:0;">Reporte de Enfermería</h2>
            </div>
            <p style="margin: 0 0 10px 0;">Folio: <strong>${folio}</strong></p>
            <p style="margin: 0 0 10px 0;">Plantel: <strong>${selectedCampus}</strong></p>
            <p style="margin: 0 0 10px 0;">Alumno: <strong>${studentName}</strong></p>
            <p style="margin: 0 0 10px 0;">Padre/Madre/Tutor: <strong>${parentName}</strong></p>
            <hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0"/>
            <h3 style="margin:0 0 8px 0;">Observaciones</h3>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">${report.replace(/\n/g, "<br/>")}</div>
            ${actions ? `
              <h3 style="margin:16px 0 8px 0;">Acciones / Recomendaciones</h3>
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">${actions.replace(/\n/g, "<br/>")}</div>
            ` : ""}
            <p style="margin-top:16px;color:#6b7280;font-size:12px;">Este mensaje ha sido enviado por Enfermería del plantel. No responda a este correo.</p>
          </div>
        `;

          const emailRes = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: [parentEmail],
              subject,
              html,
              scope: "nursing"
            })
          });

          if (!emailRes.ok) {
            const t = await emailRes.text();
            console.warn("[Nursing] email send failed", t.slice(0, 200));
            alert("Reporte registrado, pero ocurrió un problema al enviar el correo.");
          } else {
            alert("Reporte de Enfermería enviado a padres.");
          }

          // Reset form
          setParentName("");
          setParentEmail("");
          setStudentName("");
          setReport("");
          setActions("");
          setStudentPhoto("");
        } catch (e) {
          console.error("[Nursing] submit error", e);
          alert("Error de red al enviar el reporte.");
        }
        setSending(false);
      });
    }

    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-emerald-600 flex items-center gap-2">
            <Stethoscope className="w-6 h-6" />
            Reporte de Enfermería
          </h2>
          <div className="text-sm text-gray-500">{campuses.find((c) => c.value === selectedCampus)?.label}</div>
        </div>

        <div className="mb-4 p-4 rounded-lg border-2 border-emerald-300 bg-emerald-50 text-emerald-900">
          Esta sección es la única que envía reportes por correo a padres/madres/tutores.
        </div>

        <SearchStudent
          students={students}
          onSelected={(student) => {
            const pName = student.nombre_padre
              ? `${student.nombre_padre} ${student.apellido_paterno_padre ?? ""}`.trim()
              : "";
            setStudentName(`${student.nombres ?? ""} ${student.apellido_paterno ?? ""} ${student.apellido_materno ?? ""}`.trim());
            setParentName(pName);
            setParentEmail(student.email_padre || student.email_madre || "");
            setStudentPhoto(student?.matricula?.foto || "");
          }}
          placeholder="Buscar estudiante o padre para llenar datos..."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1">
            <label className="text-sm font-semibold text-gray-700">Alumno</label>
            <div className="flex items-center gap-3">
              {studentName ? (
                <div className="relative w-12 h-12 rounded-full ring-2 ring-emerald-400 overflow-hidden">
                  {/** Lazy-loaded student photo */}
                  {students && studentName && (
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
              placeholder="Indicaciones para seguimiento en casa, recomendaciones de atención médica, etc."
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={submitNursingReport}
            disabled={sending}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Stethoscope className="w-5 h-5" />}
            Enviar Reporte a Padres
          </button>
        </div>
      </div>
    );
  };

  const Dashboard = () => {
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
                  setDashSelectedMonth(""); // reset to default month for the selected school year
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

            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
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
            {dashLastLoadedAt && (
              <span className="ml-3 text-blue-700">
                Última actualización: {dashLastLoadedAt.toLocaleString("es-MX")}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
            <div className="text-sm text-gray-600 flex items-center gap-2">
              Total {kpiLoading && <Loader2 className="w-3 h-3 animate-spin text-orange-500" />}
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

        {dashLoadError ? (
          <div className="text-center py-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {dashLoadError}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No hay fichas {dashStatusFilter === "0" ? "abiertas" : "cerradas"} con los filtros seleccionados.
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
          {Object.entries(departments).map(([deptName, deptData]) => {
            const rec = deptData?.[0] || {};
            const deptEmail = rec.email || "";
            const deptNameDisp = rec.email_display_name || "";
            const supEmail = rec.supervisor_email || "";
            const supName = rec.supervisor_display_name || "";
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
                          <label className="text-sm text-gray-600">
                            Email del departamento
                          </label>
                          <input
                            type="email"
                            placeholder="Email del departamento"
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            defaultValue={deptEmail}
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
                              updateDepartment(
                                deptName,
                                editData.email || deptEmail,
                                editData.supervisor || supEmail
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
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          <span className="font-medium">Departamento:</span>{" "}
                          {displayLabel(deptEmail, deptNameDisp) || "—"}
                        </div>
                        <div>
                          <span className="font-medium">Supervisor:</span>{" "}
                          {displayLabel(supEmail, supName) || "—"}
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
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <TopActivityBar active={activeOps > 0} />
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between sm:items-center py-3">
            <div className="flex items-center gap-3">
              <div className="text-xl sm:text-2xl font-extrabold text-orange-600 tracking-tight">
                SAPF
              </div>
              <div className="hidden sm:block text-gray-400">•</div>
              <div className="text-sm sm:text-base text-gray-700">Sistema de Atención a Padres de Familia</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Plantel</label>
              <select
                className="p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
          </div>
          <div className="flex flex-wrap gap-2 pb-3">
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                currentView === "dashboard"
                  ? "bg-orange-600 text-white shadow"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              <TrendingUp className="inline w-5 h-5 mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView("form")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                currentView === "form"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              <FileText className="inline w-5 h-5 mr-2" />
              Nueva Ficha
            </button>
            <button
              onClick={() => setCurrentView("departments")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                currentView === "departments"
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              <Users className="inline w-5 h-5 mr-2" />
              Departamentos
            </button>
            <button
              onClick={() => setCurrentView("nursing")}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                currentView === "nursing"
                  ? "bg-emerald-600 text-white shadow"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <Stethoscope className="inline w-5 h-5 mr-2" />
              Reporte de Enfermería
            </button>
            <a
              href="/compare"
              className="px-4 py-2 rounded-lg font-medium transition-all bg-orange-50 text-orange-700 hover:bg-orange-100"
            >
              <TrendingUp className="inline w-5 h-5 mr-2" />
              Comparar planteles
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto py-6 px-4">
        {currentView === "dashboard" && <Dashboard />}
        {currentView === "form" && <TicketForm />}
        {currentView === "departments" && <DepartmentManager />}
        {currentView === "nursing" && <NursingReport />}
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
              await trackAsync(async () => {
                try {
                  const res = await fetch(`/api/tickets/${followTicket.id}`, { cache: "no-store" });
                  if (res.ok) {
                    const data = await res.json();
                    setFollowTicket(data);
                  }
                } catch { /* ignore */ }
              });
            }}
          />
        ) : (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando ficha…
          </div>
        )}
      </Overlay>
    </div>
  );
}

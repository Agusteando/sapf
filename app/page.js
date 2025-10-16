
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  AlertCircle,
  Save,
  FileText,
  TrendingUp,
  Lock,
  Pin,
  Stethoscope,
  Loader2
} from "lucide-react";
import Overlay from "@/components/overlay";
import SearchableSelect from "@/components/searchable-select";
import TopActivityBar from "@/components/top-activity-bar";
import SearchStudent from "@/components/search-student";
import EmailChips from "@/components/email-chips";
import Dashboard from "@/components/dashboard";
import DepartmentManager from "@/components/department-manager";
import NursingReport from "@/components/nursing-report";
import TicketCard from "@/components/ticket-card";
import FollowupForm from "@/components/followup-form";
import { departmentOptions, combinedEmailLabel } from "@/lib/ui";
import { toastError, toastSuccess, toastWarning, toastInfo } from "@/lib/notify";

export default function ParentAttentionSystem() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedCampus, setSelectedCampus] = useState("");
  const [tickets, setTickets] = useState([]);
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState({});
  const [editingDept, setEditingDept] = useState(null);
  const [schoolYears, setSchoolYears] = useState([]);
  const [defaultSchoolYear, setDefaultSchoolYear] = useState("");

  const [activeOps, setActiveOps] = useState(0);
  const trackAsync = useCallback(async (fn) => {
    setActiveOps((n) => n + 1);
    try {
      return await fn();
    } finally {
      setActiveOps((n) => Math.max(0, n - 1));
    }
  }, []);

  const [kpi, setKpi] = useState({ total: 0, abiertos: 0, cerrados: 0, quejas: 0, avg_resolucion_horas: null });
  const [kpiLoading, setKpiLoading] = useState(false);
  const lastGoodKpiRef = useRef(null);

  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followTicket, setFollowTicket] = useState(null);
  const [followDepts, setFollowDepts] = useState({});
  const [followSending, setFollowSending] = useState(false);
  const [followError, setFollowError] = useState("");

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

  const [duplicate, setDuplicate] = useState(null);
  const [institutionalNames, setInstitutionalNames] = useState({});

  const [dashStatusFilter, setDashStatusFilter] = useState("0");
  const [dashSchoolYear, setDashSchoolYear] = useState("");
  const [dashSelectedMonth, setDashSelectedMonth] = useState("");
  const [dashLastLoadedAt, setDashLastLoadedAt] = useState(null);
  const [dashLoadError, setDashLoadError] = useState("");

  const [showStats, setShowStats] = useState(false);
  const [distStats, setDistStats] = useState([]);
  const [distLoading, setDistLoading] = useState(false);

  // Load profile to set initial campus & origin department
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        const prefCampus = data?.preference?.campus || data?.detected?.campus || "";
        const prefDept = data?.preference?.department_name || data?.detected?.department_name || "";
        setSelectedCampus(prefCampus || "PMB");
        setFormData((prev) => ({
          ...prev,
          selectedDepartment: prev.selectedDepartment || prefDept || "",
        }));
      } catch {
        // fallback
        setSelectedCampus((c) => c || "PMB");
      }
    })();
    function handleProfileUpdate(e) {
      const campus = e?.detail?.campus || "";
      const department = e?.detail?.department_name || "";
      if (campus) setSelectedCampus(campus);
      if (department) setFormData((p) => ({ ...p, selectedDepartment: department }));
    }
    window.addEventListener("sapf:profile-updated", handleProfileUpdate);
    return () => {
      mounted = false;
      window.removeEventListener("sapf:profile-updated", handleProfileUpdate);
    };
  }, []);

  const campuses = useMemo(() => ([
    { value: "PMB", label: "Primaria Baja Metepec" },
    { value: "PMA", label: "Primaria Alta Metepec" },
    { value: "PT", label: "Primaria Toluca" },
    { value: "SM", label: "Secundaria Metepec" },
    { value: "ST", label: "Secundaria Toluca" },
    { value: "CM", label: "Casita Metepec" },
    { value: "CT", label: "Casita Toluca" },
    { value: "DM", label: "Desarrollo Metepec" },
  ]), []);

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

  const labelForEmail = useCallback((email, fallbackName = "") => {
    const e = String(email || "").trim();
    if (!e) return "";
    const lower = e.toLowerCase();
    const name = String(institutionalNames[lower] || fallbackName || "").trim();
    if (e && name) return `${name} <${e}>`;
    return e;
  }, [institutionalNames]);

  useEffect(() => {
    let mounted = true;
    trackAsync(async () => {
      try {
        const res = await fetch("/api/directory/names", { cache: "no-store" });
        if (!mounted) return;
        if (!res.ok) {
          console.warn("[app/page] failed to fetch precomputed names", res.status);
          return;
        }
        const data = await res.json();
        if (data?.ok && data?.names && typeof data.names === "object") {
          setInstitutionalNames(data.names);
        }
      } catch (e) {
        console.warn("[app/page] error fetching precomputed names", e?.message || e);
      }
    });
    return () => { mounted = false; };
  }, [trackAsync]);

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

  const fetchDepartments = useCallback(async () => {
    if (!selectedCampus) return;
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

  useEffect(() => {
    if (currentView === "form" || currentView === "nursing") {
      if (selectedCampus) fetchStudentData(selectedCampus);
    }
    if ((currentView === "form" || currentView === "departments") && selectedCampus) {
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

  const internalEmailSuggestions = useMemo(() => {
    const list = [];
    for (const [_, arr] of Object.entries(departments || {})) {
      for (const r of arr) {
        if (r?.email) {
          const e = String(r.email).toLowerCase();
          const name = r.email_display_name || institutionalNames[e] || "";
          list.push({ email: r.email, name });
        }
        if (r?.supervisor_email) {
          const e2 = String(r.supervisor_email).toLowerCase();
          const name2 = r.supervisor_display_name || institutionalNames[e2] || "";
          list.push({ email: r.supervisor_email, name: name2 });
        }
      }
    }
    const map = new Map();
    for (const item of list) {
      const key = String(item.email || "").toLowerCase();
      if (!map.has(key)) map.set(key, item);
    }
    return Array.from(map.values());
  }, [departments, institutionalNames]);

  const defaultMonthForSchoolYear = useCallback((sy) => {
    try {
      const [startYearStr, endYearStr] = String(sy || "").split("-");
      const startYear = parseInt(startYearStr, 10);
      const endYear = parseInt(endYearStr, 10);
      if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return "";

      const now = new Date();
      const nowY = now.getFullYear();
      const nowM = now.getMonth();
      const inFirstSpan = nowY === startYear && nowM >= 7;
      const inSecondSpan = nowY === endYear && nowM <= 6;

      if (inFirstSpan || inSecondSpan) {
        const yyyy = inFirstSpan ? startYear : endYear;
        const mm = String(nowM + 1).padStart(2, "0");
        return `${yyyy}-${mm}`;
      }
      return `${startYear}-08`;
    } catch {
      return "";
    }
  }, []);

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
    let qs = `campus=${encodeURIComponent(selectedCampus || "")}`;
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
    if (currentView === "dashboard" && selectedCampus) {
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
          if (!selectedCampus) return;
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

  function computeMonthRange(yyyyMm) {
    if (!/^\d{4}-\d{2}$/.test(String(yyyyMm || ""))) return null;
    const [yStr, mStr] = yyyyMm.split("-");
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const start = new Date(y, m, 1, 0, 0, 0);
    const end = new Date(y, m + 1, 0, 23, 59, 59);
    return {
      start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")} 00:00:00`,
      end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")} 23:59:59`,
    };
  }

  const exportToExcel = () => {
    if (!selectedCampus) {
      toastWarning("Selecciona un plantel para exportar.");
      return;
    }
    const base = `/api/export-excel?campus=${encodeURIComponent(selectedCampus)}&status=`;
    const r = computeMonthRange(dashSelectedMonth);
    if (r) {
      window.open(`${base}&startDate=${encodeURIComponent(r.start)}&endDate=${encodeURIComponent(r.end)}`, "_blank");
      toastInfo("Exportando datos del mes seleccionado…");
    } else if (dashSchoolYear) {
      const [startYear, endYear] = dashSchoolYear.split("-").map(Number);
      const start = `${startYear}-08-01 00:00:00`;
      const end = `${endYear}-08-01 00:00:00`;
      window.open(`${base}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`, "_blank");
      toastInfo("Exportando datos del ciclo escolar seleccionado…");
    } else {
      window.open(base, "_blank");
      toastInfo("Exportando datos…");
    }
  };

  const canSubmitTicket = Boolean(selectedCampus && formData.selectedDepartment);

  const submitTicket = async () => {
    if (!canSubmitTicket) {
      toastWarning("Configura tu Plantel y Departamento en la barra superior antes de generar una ficha.");
      return;
    }
    if (!formData.parentName || !formData.reason || !formData.resolution) {
      toastWarning("Por favor complete todos los campos requeridos");
      return;
    }

    await trackAsync(async () => {
      try {
        const departmentEmail = departments[formData.selectedDepartment]?.[0]?.email || "";

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
            cc_emails: formData.ccEmails
          }),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          const folio = result.folioNumber || String(result.ticketId || "").padStart(5, "0");
          toastSuccess(`Ficha generada exitosamente. Folio: ${folio}`);
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
            selectedDepartment: Object.keys(departments)[0] || "Enfermería",
            existingOpenTicketId: null,
            studentPhotoUrl: "",
            ccEmails: []
          });
        } else {
          toastError(result?.error || "No se pudo generar la ficha");
        }
      } catch (error) {
        console.error("Error submitting ticket:", error);
        toastError("Error al generar la ficha");
      }
    });
  };

  async function onOpenFollowup(ticket) {
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
  }

  async function onSubmitFollowup(payload) {
    const { resolution, status, targetDepartment, ccEmails } = payload || {};
    setFollowError("");
    if (!followTicket) return;
    if (!resolution || resolution.trim().length === 0) {
      setFollowError("Escribe el texto del seguimiento.");
      return;
    }
    setFollowSending(true);
    await trackAsync(async () => {
      try {
        const res = await fetch(`/api/tickets/${followTicket.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
          body: JSON.stringify({
            resolution,
            status,
            target_department: targetDepartment || "",
            cc_emails: ccEmails || []
          })
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          setFollowError(data?.error || "No se pudo guardar el seguimiento.");
          setFollowSending(false);
          return;
        }
        await trackAsync(async () => {
          try {
            const r = await fetch(`/api/tickets/${followTicket.id}`, { cache: "no-store" });
            if (r.ok) {
              const fresh = await r.json();
              setFollowTicket(fresh);
            }
          } catch { /* ignore */ }
        });
        toastSuccess("Seguimiento guardado.");
      } catch (e) {
        console.error("[Followup] submit error", e);
        setFollowError("Error de red al guardar el seguimiento.");
      }
      setFollowSending(false);
    });
  }

  async function onStudentSelectedForForm(student) {
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
  }

  async function updateDepartment(department_name, email, supervisor_email) {
    await trackAsync(async () => {
      try {
        const res = await fetch(`/api/departments/${selectedCampus}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-client": "sapf-app" },
          body: JSON.stringify({ department_name, email, supervisor_email }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          toastError(data?.error || "No se pudo guardar el departamento");
          return;
        }
        setEditingDept(null);
        await fetchDepartments();
        toastSuccess("Departamento actualizado.");
      } catch (e) {
        console.error("[DepartmentManager] updateDepartment error", e);
        toastError("Error de red al guardar el departamento");
      }
    });
  }

  async function onNursingStudentSelected(student, prefill) {
    console.log("[Nursing] onStudentSelected", !!student, prefill?.studentName || "");
  }

  async function onSubmitNursingReport({ parentName, parentEmail, studentName, report, actions }) {
    if (!selectedCampus) {
      toastWarning("Configura tu Plantel en la barra superior.");
      return;
    }
    if (!parentName || !parentEmail || !studentName || !report) {
      toastWarning("Completa los campos requeridos (Padre/Madre, Correo, Alumno, Reporte).");
      return;
    }
    setActiveOps((n) => n + 1);
    try {
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
        toastError(created?.error || "No se pudo registrar el reporte.");
        return;
      }

      const folio = created.folioNumber || String(created.ticketId).padStart(5, "0");
      const subject = `Reporte de Enfermería — Folio ${folio}`;
      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827;">
          <h2 style="color:#356635;margin:0 0 10px 0;">Reporte de Enfermería</h2>
          <p style="margin: 0 0 10px 0;">Folio: <strong>${folio}</strong></p>
          <p style="margin: 0 0 10px 0;">Plantel: <strong>${selectedCampus}</strong></p>
          <p style="margin: 0 0 10px 0;">Alumno: <strong>${studentName}</strong></p>
          <p style="margin: 0 0 10px 0;">Padre/Madre/Tutor: <strong>${parentName}</strong></p>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0"/>
          <h3 style="margin:0 0 8px 0;">Observaciones</h3>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">${(report || "").replace(/\n/g, "<br/>")}</div>
          ${actions ? `
            <h3 style="margin:16px 0 8px 0;">Acciones / Recomendaciones</h3>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">${(actions || "").replace(/\n/g, "<br/>")}</div>
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
        toastWarning("Reporte registrado, pero ocurrió un problema al enviar el correo.");
      } else {
        toastSuccess("Reporte de Enfermería enviado a padres.");
      }
    } catch (e) {
      console.error("[Nursing] submit error", e);
      toastError("Error de red al enviar el reporte.");
    } finally {
      setActiveOps((n) => Math.max(0, n - 1));
    }
  }

  const originDepartments = useMemo(() => {
    const mapped = Object.keys(departments || {});
    if (mapped.length > 0) return mapped;
    return fallbackDepartmentOptions;
  }, [departments]);

  const canalizarOptions = useMemo(() => departmentOptions(departments, institutionalNames), [departments, institutionalNames]);

  const canalizadoRec = departments[formData.targetDepartment]?.[0] || {};
  const canalizadoEmail = canalizadoRec.email || "";
  const canalizadoName = institutionalNames[canalizadoEmail?.toLowerCase?.()] || canalizadoRec.email_display_name || "";
  const canalizadoSup = canalizadoRec.supervisor_email || "";
  const canalizadoSupName = institutionalNames[canalizadoSup?.toLowerCase?.()] || canalizadoRec.supervisor_display_name || "";
  const canalizadoCombined = combinedEmailLabel(canalizadoEmail, canalizadoName) || "—";
  const canalizadoSupCombined = combinedEmailLabel(canalizadoSup, canalizadoSupName) || "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <TopActivityBar active={activeOps > 0} />

      <main className="max-w-screen-xl mx-auto py-6 px-4">
        {/* Route tabs */}
        <div className="flex flex-wrap gap-2 pb-4">
          <button
            onClick={() => setCurrentView("dashboard")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentView === "dashboard"
                ? "bg-[#004E66] text-white shadow"
                : "bg-[#E6F3F6] text-[#004E66] hover:bg-[#E6F3F6]/80"
            }`}
          >
            <TrendingUp className="inline w-5 h-5 mr-2" />
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView("form")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentView === "form"
                ? "bg-[#6DA544] text-white shadow"
                : "bg-[#eaf3e6] text-[#356635] hover:bg-[#eaf3e6]/80"
            }`}
          >
            <FileText className="inline w-5 h-5 mr-2" />
            Nueva Ficha
          </button>
          <button
            onClick={() => setCurrentView("departments")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentView === "departments"
                ? "bg-[#018B9C] text-white shadow"
                : "bg-[#E6F3F6] text-[#004E66] hover:bg-[#E6F3F6]/80"
            }`}
          >
            Departamentos
          </button>
          <button
            onClick={() => setCurrentView("nursing")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              currentView === "nursing"
                ? "bg-[#F7931E] text-white shadow"
                : "bg-[#FFF3E6] text-[#7a4a05] hover:bg-[#FFF3E6]/80"
            }`}
          >
            <Stethoscope className="inline w-5 h-5 mr-2" />
            Reporte de Enfermería
          </button>
          <a
            href="/compare"
            className="px-4 py-2 rounded-lg font-medium transition-all bg-[#E6F3F6] text-[#004E66] hover:bg-[#E6F3F6]/80"
          >
            Comparar planteles
          </a>
        </div>

        {currentView === "dashboard" && selectedCampus && (
          <Dashboard
            kpi={lastGoodKpiRef.current || kpi}
            kpiLoading={kpiLoading}
            tickets={tickets}
            statusFilter={dashStatusFilter}
            setStatusFilter={setDashStatusFilter}
            schoolYears={schoolYears}
            dashSchoolYear={dashSchoolYear}
            setDashSchoolYear={setDashSchoolYear}
            monthsForSchoolYear={monthsForSchoolYear}
            dashSelectedMonth={dashSelectedMonth}
            setDashSelectedMonth={setDashSelectedMonth}
            onExport={exportToExcel}
            showStats={showStats}
            setShowStats={setShowStats}
            distStats={distStats}
            distLoading={distLoading}
            lastLoadedAt={dashLastLoadedAt}
            loadError={dashLoadError}
            onOpenFollowup={onOpenFollowup}
          />
        )}

        {currentView === "form" && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-title text-2xl text-[#004E66]">
                Nueva Ficha {selectedCampus ? `— ${campuses.find((c) => c.value === selectedCampus)?.label}` : ""}
              </h2>
              {formData.studentPhotoUrl ? (
                <div className="relative w-16 h-16 rounded-full ring-4 ring-[#F7931E] overflow-hidden">
                  <img src={formData.studentPhotoUrl} alt="Alumno" loading="lazy" className="w-full h-full object-cover" />
                </div>
              ) : null}
            </div>

            {!canSubmitTicket && (
              <div className="mb-4 p-4 bg-[#ffe9e3] border border-[#ffd3c8] rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#E94E1B]" />
                <span className="text-[#7a200f]">
                  Configura tu Plantel y Departamento desde la barra superior para poder generar fichas.
                </span>
              </div>
            )}

            <SearchStudent
              students={students}
              onSelected={onStudentSelectedForForm}
            />

            {duplicate && duplicate.dup === 1 && (
              <div className="mt-3 p-4 bg-[#ffe9e3] border border-[#ffd3c8] rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#E94E1B]" />
                <span className="text-[#7a200f]">
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
                  value={formData.resolution}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, resolution: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-gray-700">Medio de contacto</label>
                <select
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                    className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C] disabled:bg-gray-100 disabled:text-gray-500"
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
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                <SearchableSelect
                  options={[
                    { value: "", label: "Sin canalización", email: "", displayName: "", combined: "" },
                    ...canalizarOptions
                  ]}
                  value={formData.targetDepartment}
                  onChange={(value) => setFormData((p) => ({ ...p, targetDepartment: value }))}
                  placeholder="Seleccionar departamento..."
                  getOptionLabel={(opt) => opt.label}
                  getOptionValue={(opt) => opt.value}
                  renderOption={(opt) => (
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{opt.label}</span>
                      {opt.combined && (
                        <span className="text-xs text-gray-500 mt-0.5">{opt.combined}</span>
                      )}
                    </div>
                  )}
                />
              </div>
              <div className="grid gap-3">
                <label className="text-sm font-semibold text-gray-700">Estatus</label>
                <select
                  className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#018B9C]"
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
                <div className="rounded border border-[#cde6eb] bg-[#E6F3F6] p-3 text-sm text-[#004E66]">
                  {formData.targetDepartment ? (
                    <>Se notificará al departamento y su supervisor. Puedes agregar copias internas abajo.</>
                  ) : (
                    <>No hay canalización seleccionada. Si canalizas, se notificará automáticamente al departamento y su supervisor.</>
                  )}
                  {formData.targetDepartment && (
                    <div className="mt-2">
                      Correos adicionales (internos):
                      <EmailChips
                        value={formData.ccEmails}
                        onChange={(next) => setFormData((p) => ({ ...p, ccEmails: next }))}
                        suggestions={internalEmailSuggestions}
                      />
                    </div>
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
                disabled={!canSubmitTicket}
                className="px-5 py-2 bg-[#F7931E] hover:bg-[#e88510] text-white rounded-lg flex items-center gap-2 disabled:opacity-60"
              >
                {activeOps > 0 ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Guardar Ficha
              </button>
            </div>
          </div>
        )}

        {currentView === "departments" && selectedCampus && (
          <DepartmentManager
            campusLabel={campuses.find((c) => c.value === selectedCampus)?.label}
            departments={departments}
            institutionalNames={institutionalNames}
            editingDept={editingDept}
            setEditingDept={setEditingDept}
            onUpdateDepartment={updateDepartment}
          />
        )}

        {currentView === "nursing" && selectedCampus && (
          <NursingReport
            selectedCampusLabel={campuses.find((c) => c.value === selectedCampus)?.label}
            students={students}
            onStudentSelected={onNursingStudentSelected}
            onSubmit={onSubmitNursingReport}
            sending={activeOps > 0}
          />
        )}

        {!selectedCampus && (
          <div className="mt-4 p-4 bg-[#E6F3F6] border border-[#cde6eb] rounded-lg text-[#004E66]">
            Selecciona o configura tu Plantel desde la barra superior para continuar.
          </div>
        )}
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
            institutionalNames={institutionalNames}
            sending={followSending}
            error={followError}
            onSubmit={onSubmitFollowup}
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

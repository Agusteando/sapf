
"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Building2, LogOut, MapPin, Settings2, UserCircle2 } from "lucide-react";
import SearchableSelect from "@/components/searchable-select";
import ToastViewport from "@/components/toast-viewport";
import { toastError, toastWarning, toastSuccess } from "@/lib/notify";

export default function SiteHeader() {
  const [openPanel, setOpenPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [campusOptions, setCampusOptions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selCampus, setSelCampus] = useState("");
  const [selDept, setSelDept] = useState("");
  const [authed, setAuthed] = useState(null); // null = unknown, true = logged in, false = not logged in

  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const hideOnLogin = pathname.startsWith("/login");

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("profile fetch failed");
      const data = await res.json();
      setAuthed(true);
      setProfile(data);
      setCampusOptions(Array.isArray(data.campusOptions) ? data.campusOptions : []);
      const preferredCampus = data?.preference?.campus || data?.detected?.campus || "";
      const preferredDept = data?.preference?.department_name || data?.detected?.department_name || "";
      setSelCampus(preferredCampus);
      setSelDept(preferredDept);
      if (preferredCampus) {
        const d = await fetch(`/api/departments/${encodeURIComponent(preferredCampus)}`, { cache: "no-store" });
        if (d.ok) {
          const rows = await d.json();
          const list = (Array.isArray(rows) ? rows : []).map((r) => r.department_name);
          setDepartments(list);
        }
      }
      // dispatch current to app
      window.dispatchEvent(new CustomEvent("sapf:profile-updated", { detail: { campus: preferredCampus, department_name: preferredDept } }));
    } catch (e) {
      console.warn("[SiteHeader] loadProfile error", e?.message || e);
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hideOnLogin) loadProfile();
  }, [hideOnLogin, loadProfile]);

  async function onCampusChange(next) {
    setSelCampus(next);
    setSelDept("");
    if (next) {
      const d = await fetch(`/api/departments/${encodeURIComponent(next)}`, { cache: "no-store" });
      if (d.ok) {
        const rows = await d.json();
        const list = (Array.isArray(rows) ? rows : []).map((r) => r.department_name);
        setDepartments(list);
      } else {
        setDepartments([]);
      }
    } else {
      setDepartments([]);
    }
  }

  async function savePref() {
    if (!selCampus || !selDept) {
      toastWarning("Selecciona plantel y departamento");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campus: selCampus, department_name: selDept })
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        toastError(data?.error || "No se pudo guardar la preferencia");
        return;
      }
      localStorage.setItem("sapf_pref", JSON.stringify({ campus: selCampus, department_name: selDept }));
      window.dispatchEvent(new CustomEvent("sapf:profile-updated", { detail: { campus: selCampus, department_name: selDept } }));
      setOpenPanel(false);
      toastSuccess("Preferencias guardadas.");
    } catch (e) {
      console.warn("[SiteHeader] savePref error", e?.message || e);
      toastError("Error de red al guardar la preferencia");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    window.location.assign("/login");
  }

  // Hide header on login page or when not authenticated (unknown or false).
  if (hideOnLogin || authed !== true) return (
    <>
      <ToastViewport />
    </>
  );

  const userName = profile?.user?.name || "";
  const userEmail = profile?.user?.email || "";
  const userPic = profile?.user?.picture || "";
  const activeCampus = selCampus || profile?.detected?.campus || "";
  const activeDept = selDept || profile?.detected?.department_name || "";

  const needsConfig = !(activeCampus && activeDept);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="relative w-48 h-12 sm:w-60 sm:h-14">
                <Image src="/sapf-h.png" alt="SAPF" fill className="object-contain" priority />
              </div>
              <div className="hidden sm:flex items-center gap-2 text-gray-500">
                <span>•</span>
                <span className="font-title text-[#004E66]">Sistema de Atención a Padres de Familia</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <div className="text-sm text-gray-700">
                  Bienvenido(a){userName ? `, ${userName}` : ""}.
                </div>
                {userEmail && <div className="text-xs text-gray-500">{userEmail}</div>}
              </div>
              <div className="w-10 h-10 rounded-full bg-[#E6F3F6] overflow-hidden ring-2 ring-[#018B9C]">
                {userPic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userPic} alt={userName || "Usuario"} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#004E66]">
                    <UserCircle2 className="w-7 h-7" />
                  </div>
                )}
              </div>
              <button
                onClick={() => setOpenPanel((o) => !o)}
                className={`px-3 py-2 rounded-lg border flex items-center gap-2 ${needsConfig ? "border-[#E94E1B] text-[#7a200f] bg-[#ffe9e3]" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                aria-haspopup="dialog"
                aria-expanded={openPanel}
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">{needsConfig ? "Configurar" : "Preferencias"}</span>
              </button>
              <button
                onClick={logout}
                className="px-3 py-2 rounded-lg bg-[#004E66] text-white hover:bg-[#003d4f] flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Active context bar */}
          <div className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Contexto activo:</span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${activeCampus ? "border-[#018B9C] text-[#004E66] bg-[#E6F3F6]" : "border-[#E94E1B] text-[#7a200f] bg-[#ffe9e3]"}`}>
                <MapPin className="w-3.5 h-3.5" />
                {activeCampus || "Plantel no establecido"}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${activeDept ? "border-[#6DA544] text-[#356635] bg-[#eaf3e6]" : "border-[#E94E1B] text-[#7a200f] bg-[#ffe9e3]"}`}>
                <Building2 className="w-3.5 h-3.5" />
                {activeDept || "Departamento no establecido"}
              </span>
              {needsConfig && (
                <span className="text-xs text-[#7a200f] bg-[#ffe9e3] border border-[#ffd3c8] px-2 py-1 rounded-full">
                  Requerido para generar fichas
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Configuration panel */}
        {openPanel && (
          <div className="border-t border-gray-200 bg-white">
            <div className="max-w-screen-xl mx-auto px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1">
                  <label className="text-sm font-medium text-gray-700">Plantel</label>
                  <SearchableSelect
                    options={campusOptions.map((c) => ({ value: c.value, label: c.label }))}
                    value={selCampus}
                    onChange={onCampusChange}
                    placeholder="Selecciona tu plantel"
                  />
                </div>
                <div className="grid gap-1 sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Departamento</label>
                  <SearchableSelect
                    options={departments.map((d) => ({ value: d, label: d }))}
                    value={selDept}
                    onChange={setSelDept}
                    placeholder={selCampus ? "Selecciona tu departamento" : "Primero selecciona plantel"}
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={savePref}
                  disabled={loading || !selCampus || !selDept}
                  className="px-4 py-2 rounded-lg bg-[#6DA544] text-white hover:bg-[#356635] disabled:opacity-60"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setOpenPanel(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      <ToastViewport />
    </>
  );
}

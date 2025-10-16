
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { TrendingUp } from "lucide-react";

export default function CompareCampusesPage() {
  const [schoolYears, setSchoolYears] = useState([]);
  const [defaultSchoolYear, setDefaultSchoolYear] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load school years
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/stats/school-years", { cache: "no-store" });
        const data = await r.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        setSchoolYears(items);
        setDefaultSchoolYear(data?.default || "");
        setSchoolYear(data?.default || items[0] || "");
      } catch (e) {
        console.warn("[compare] failed to fetch school years", e);
        const now = new Date();
        const y = now.getFullYear();
        const base = now.getMonth() >= 7 ? y : y - 1;
        const fallback = [];
        for (let i = 0; i < 6; i++) {
          fallback.push(`${base - i}-${base - i + 1}`);
        }
        setSchoolYears(fallback);
        setDefaultSchoolYear(fallback[0]);
        setSchoolYear(fallback[0]);
      }
    })();
  }, []);

  const months = useMemo(() => {
    if (!schoolYear) return [];
    const [startYear, endYear] = schoolYear.split("-").map(Number);
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
  }, [schoolYear]);

  // Client-side dedupe for compare fetches
  const lastKeyRef = useRef("");
  const lastAtRef = useRef(0);

  // Fetch comparison data
  useEffect(() => {
    const key = JSON.stringify({ schoolYear, selectedMonth });
    const now = Date.now();
    if (lastKeyRef.current === key && (now - lastAtRef.current) < 3000) {
      return;
    }
    lastKeyRef.current = key;
    lastAtRef.current = now;

    (async () => {
      try {
        setLoading(true);
        let url = "/api/stats/compare?";
        if (selectedMonth) {
          url += `month=${encodeURIComponent(selectedMonth)}`;
        } else if (schoolYear) {
          url += `schoolYear=${encodeURIComponent(schoolYear)}`;
        }
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn("[compare] fetch failed", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [schoolYear, selectedMonth]);

  const maxTotal = Math.max(1, ...rows.map((r) => Number(r.total || 0)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-brand-gradient text-white shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="relative w-32 h-8">
                <Image src="/sapf-h.png" alt="SAPF" fill className="object-contain" />
              </div>
              <span className="hidden sm:block text-white/80">Comparativo por Plantel</span>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-white text-[#004E66] rounded-lg hover:bg-[#E8E3D3] hover:text-[#004E66]"
            >
              Volver
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto py-8 px-4">
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="font-semibold text-gray-700">Ciclo Escolar:</label>
              <select
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#018B9C]"
                value={schoolYear}
                onChange={(e) => {
                  setSchoolYear(e.target.value);
                  setSelectedMonth("");
                }}
              >
                {schoolYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="font-semibold text-gray-700">Mes:</label>
              <select
                className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#018B9C]"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">Todos</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-[#F7931E] border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Cargando comparativo...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg shadow">
            <p className="text-gray-600 text-lg">Sin datos para el periodo seleccionado.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="grid grid-cols-1 gap-0">
              <div className="grid grid-cols-5 gap-2 p-4 bg-gray-50 text-sm font-semibold text-gray-700">
                <div>Plantel</div>
                <div className="text-right">Total</div>
                <div className="text-right">Abiertos</div>
                <div className="text-right">Cerrados</div>
                <div className="text-right">Quejas</div>
              </div>
              {rows.map((r, idx) => (
                <div
                  key={`${r.campus}-${idx}`}
                  className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border-t p-4"
                >
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-gray-800">{r.campus}</span>
                    <div className="w-full h-3 bg-gray-100 rounded">
                      <div
                        className="h-3 bg-gradient-to-r from-[#6DA544] to-[#018B9C] rounded"
                        style={{ width: `${(Number(r.total || 0) / maxTotal) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="md:text-right text-gray-800 font-semibold">{r.total}</div>
                  <div className="md:text-right text-[#E94E1B] font-semibold">{r.abiertos}</div>
                  <div className="md:text-right text-[#356635] font-semibold">{r.cerrados}</div>
                  <div className="md:text-right text-[#004E66] font-semibold">{r.quejas}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

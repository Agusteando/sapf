
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Check, Search, X } from "lucide-react";

export default function SearchableSelect({
  options = [],
  value = "",
  onChange,
  placeholder = "Seleccionar…",
  getOptionLabel = (o) => o?.label ?? "",
  getOptionValue = (o) => o?.value ?? "",
  renderOption,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const map = useMemo(() => {
    const m = new Map();
    for (const o of options) {
      m.set(getOptionValue(o), o);
    }
    return m;
  }, [options, getOptionValue]);

  const current = map.get(value);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const arr = options;
    if (!term) return arr.slice(0, 50);
    return arr
      .filter((o) => {
        const hay = `${getOptionLabel(o)} ${o?.combined || ""} ${o?.email || ""}`.toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 50);
  }, [q, options, getOptionLabel]);

  useEffect(() => {
    function onDocClick(ev) {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(ev.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function select(val) {
    onChange && onChange(val);
    setOpen(false);
    setQ("");
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50"
      >
        <span className="truncate">
          {current ? getOptionLabel(current) : <span className="text-gray-500">{placeholder}</span>}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 text-gray-500" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-lg border border-[#cde6eb] bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-gray-100 px-2 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Limpiar"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ul className="max-h-72 overflow-auto divide-y divide-gray-100">
            {filtered.map((opt) => {
              const val = getOptionValue(opt);
              const isSel = val === value;
              return (
                <li key={val}>
                  <button
                    type="button"
                    onClick={() => select(val)}
                    className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-[#E6F3F6] ${isSel ? "bg-[#E6F3F6]" : ""}`}
                  >
                    {opt?.photoUrl ? (
                      <img src={opt.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                    ) : null}
                    <div className="min-w-0 text-left">
                      {renderOption ? (
                        renderOption(opt)
                      ) : (
                        <>
                          <div className="text-sm text-gray-900 truncate">{getOptionLabel(opt)}</div>
                          {opt?.combined ? (
                            <div className="text-xs text-gray-500 truncate">{opt.combined}</div>
                          ) : null}
                        </>
                      )}
                    </div>
                    {isSel ? <Check className="ml-auto h-4 w-4 text-[#004E66]" /> : null}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-3 text-sm text-gray-500">Sin resultados</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}


"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { X, Plus, Search } from "lucide-react";

function nrm(e) {
  return String(e || "").trim().toLowerCase();
}

function Chip({ email, name, photoUrl, onRemove }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#E6F3F6] text-[#004E66] px-3 py-1 text-sm">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-5 w-5 rounded-full object-cover" loading="lazy" />
      ) : (
        <span className="h-5 w-5 rounded-full bg-white/70 flex items-center justify-center text-[10px] font-semibold">
          {String(name || email || "").trim().slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="max-w-[50vw] sm:max-w-[24rem] truncate">
        <span className="font-medium">{name || "—"}</span>
        <span className="text-gray-600">{email ? ` <${email}>` : ""}</span>
      </span>
      <button
        onClick={onRemove}
        aria-label="Quitar"
        className="rounded-full hover:bg-[#d6eaf0] p-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </span>
  );
}

export default function EmailChips({ value = [], onChange, suggestions = [] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  const suggestionMap = useMemo(() => {
    const m = new Map();
    for (const s of suggestions) {
      const email = nrm(s.email);
      if (!email) continue;
      if (!m.has(email)) {
        m.set(email, { email, name: s.name || "", photoUrl: s.photoUrl || "" });
      }
    }
    return m;
  }, [suggestions]);

  const selected = useMemo(() => {
    return (Array.isArray(value) ? value : []).map((email) => {
      const e = nrm(email);
      const sug = suggestionMap.get(e);
      return {
        email,
        name: sug?.name || "",
        photoUrl: sug?.photoUrl || "",
      };
    });
  }, [value, suggestionMap]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const selSet = new Set((Array.isArray(value) ? value : []).map((v) => nrm(v)));
    const arr = Array.from(suggestionMap.values());
    if (!term) return arr.filter((s) => !selSet.has(nrm(s.email))).slice(0, 8);
    return arr
      .filter((s) => {
        if (selSet.has(nrm(s.email))) return false;
        const hay = `${s.email} ${s.name}`.toLowerCase();
        return hay.includes(term);
      })
      .slice(0, 12);
  }, [q, suggestionMap, value]);

  function addEmail(email) {
    const e = nrm(email);
    if (!e) return;
    const set = new Set(Array.isArray(value) ? value.map(nrm) : []);
    if (set.has(e)) return;
    onChange && onChange([...(Array.isArray(value) ? value : []), e]);
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && q.trim()) {
        addEmail(filtered[0].email);
      } else if (q.includes("@")) {
        addEmail(q.trim());
      }
    }
    if (e.key === "Backspace" && !q) {
      const next = [...(Array.isArray(value) ? value : [])];
      next.pop();
      onChange && onChange(next);
    }
  }

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

  return (
    <div className="w-full" ref={boxRef}>
      <div className="min-h-[2.5rem] w-full rounded-lg border border-[#cde6eb] bg-white px-2 py-1 flex flex-wrap items-center gap-2">
        {selected.map((s) => (
          <Chip
            key={s.email}
            email={s.email}
            name={s.name}
            photoUrl={s.photoUrl}
            onRemove={() => {
              const next = (Array.isArray(value) ? value : []).filter((v) => nrm(v) !== nrm(s.email));
              onChange && onChange(next);
            }}
          />
        ))}

        <div className="relative flex-1 min-w-[8rem]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Agregar correo interno…"
            className="w-full rounded-md border border-transparent bg-transparent pl-8 pr-2 py-2 text-sm focus:outline-none"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-1 top-1.5 rounded-md p-1 text-gray-500 hover:bg-gray-100"
              aria-label="Limpiar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && filtered.length > 0 && (
        <div className="mt-2 max-h-64 w-full overflow-auto rounded-lg border border-[#cde6eb] bg-white shadow-lg">
          <ul className="divide-y divide-gray-100">
            {filtered.map((s) => (
              <li key={s.email}>
                <button
                  type="button"
                  onClick={() => addEmail(s.email)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#E6F3F6]"
                >
                  {s.photoUrl ? (
                    <img src={s.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-semibold">
                      {String(s.name || s.email || "").trim().slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 text-left">
                    <div className="text-sm text-gray-900 truncate">{s.name || "—"}</div>
                    <div className="text-xs text-gray-500 truncate">{s.email}</div>
                  </div>
                  <Plus className="ml-auto h-4 w-4 text-[#004E66]" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

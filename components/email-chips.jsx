
"use client";

import React, { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";

export default function EmailChips({ value, onChange, suggestions = [] }) {
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
      <div className="flex flex-wrap gap-2 items-center rounded border border-[#018B9C] bg-[#E8E3D3]/60 p-2">
        {(value || []).map((email) => {
          const sug = resolveSuggestion(email);
          return (
            <span key={email} className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[#018B9C] text-white text-xs">
              <span className="font-medium">{sug?.name || email}</span>
              <span className="opacity-90">&lt;{email}&gt;</span>
              <button onClick={() => removeEmail(email)} className="ml-1 hover:text-[#E8E3D3]" aria-label="Quitar">
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
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#6DA544] text-white text-xs hover:bg-[#356635]"
          onClick={() => input && addEmail(input)}
        >
          <Plus className="w-3 h-3" />
          Agregar
        </button>
      </div>
      {open && filtered.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded border border-[#018B9C]/40 bg-white shadow">
          {filtered.map((s) => (
            <div
              key={s.email}
              className="px-3 py-2 text-sm hover:bg-[#E8E3D3]/40 cursor-pointer flex items-center gap-2"
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

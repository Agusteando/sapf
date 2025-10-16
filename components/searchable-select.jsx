
// components/searchable-select.jsx

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";

export default function SearchableSelect({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Seleccionar...",
  renderOption,
  getOptionLabel,
  getOptionValue,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  // Default functions if not provided
  const defaultGetLabel = (opt) => opt?.label || String(opt || "");
  const defaultGetValue = (opt) => opt?.value || String(opt || "");
  const defaultRender = (opt) => defaultGetLabel(opt);

  const labelFn = getOptionLabel || defaultGetLabel;
  const valueFn = getOptionValue || defaultGetValue;
  const renderFn = renderOption || defaultRender;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter options based on search
  const filteredOptions = options.filter((opt) => {
    if (!search) return true;
    const label = labelFn(opt).toLowerCase();
    return label.includes(search.toLowerCase());
  });

  // Get selected option display
  const selectedOption = options.find((opt) => valueFn(opt) === value);
  const selectedLabel = selectedOption ? labelFn(selectedOption) : placeholder;

  const handleSelect = (option) => {
    onChange?.(valueFn(option));
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 p-3 border border-gray-300 rounded-lg bg-white hover:bg-[#E8E3D3]/40 focus:outline-none focus:ring-2 focus:ring-[#018B9C] transition-colors"
      >
        <span className={`truncate ${!selectedOption ? "text-gray-500" : "text-gray-900"}`}>
          {selectedLabel}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-[#E8E3D3]/30">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="flex-1 bg-transparent outline-none text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-64">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No se encontraron resultados
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const optValue = valueFn(option);
                const isSelected = optValue === value;
                return (
                  <button
                    key={`${optValue}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[#E8E3D3]/40 transition-colors ${
                      isSelected ? "bg-[#E6F3F6] text-[#004E66]" : "text-gray-900"
                    }`}
                  >
                    <span className="flex-1 text-sm">
                      {renderFn(option)}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#018B9C] flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

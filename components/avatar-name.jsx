
"use client";

import React, { useMemo } from "react";

// Email regex used for basic validation
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function initialsFrom(text) {
  const s = String(text || "").trim();
  if (!s) return "•";
  const parts = s.split(/\s+/g).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || s[0].toUpperCase();
}

export default function AvatarName({
  email,
  nameOverride = "",
  photoUrlOverride = "",
  institutionalProfiles = {},
  size = "md",
  showEmail = false,
  className = "",
}) {
  const emailKey = String(email || "").trim().toLowerCase();
  const profile = institutionalProfiles[emailKey] || {};
  const fullName = String(nameOverride || profile.name || "").trim();
  const photoUrl = String(photoUrlOverride || profile.photoUrl || "").trim();

  const dims = useMemo(() => {
    // Tailwind uses rem-based sizing; avoid px units
    switch (size) {
      case "xs":
        return { img: "h-6 w-6", text: "text-xs", gap: "gap-2" };
      case "sm":
        return { img: "h-8 w-8", text: "text-sm", gap: "gap-2" };
      case "lg":
        return { img: "h-12 w-12", text: "text-base", gap: "gap-3" };
      default:
        return { img: "h-10 w-10", text: "text-sm", gap: "gap-3" };
    }
  }, [size]);

  const badge = useMemo(() => {
    if (!emailKey || !EMAIL_RE.test(emailKey)) return null;
    if (!photoUrl) {
      const ini = initialsFrom(fullName || emailKey.split("@")[0]);
      return (
        <div
          className={`flex items-center justify-center ${dims.img} rounded-full bg-[#E6F3F6] text-[#004E66] font-semibold`}
          aria-hidden="true"
        >
          {ini}
        </div>
      );
    }
    return (
      <img
        src={photoUrl}
        alt={fullName ? `Foto de ${fullName}` : "Foto de usuario"}
        className={`${dims.img} rounded-full object-cover`}
        loading="lazy"
      />
    );
  }, [emailKey, photoUrl, fullName, dims]);

  return (
    <div className={`flex items-center ${dims.gap} min-w-0 ${className}`}>
      {badge}
      <div className="min-w-0">
        <div className={`font-medium text-gray-900 truncate ${dims.text}`}>
          {fullName || emailKey || "Usuario"}
        </div>
        {showEmail && emailKey ? (
          <div className="text-gray-600 text-xs truncate">{emailKey}</div>
        ) : null}
      </div>
    </div>
  );
}

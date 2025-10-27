
"use client";

import React from "react";

/**
 * Avatar renders a circular image or an initial-based fallback with optional ring accent.
 * - name: string used for alt and fallback initial
 * - photoUrl: image source; if absent, renders initial badge
 * - sizeClass: Tailwind size classes, default h-10 w-10
 * - ringClass: Tailwind ring classes, default ring-0
 */
export default function Avatar({ name = "", photoUrl = "", sizeClass = "h-10 w-10", ringClass = "ring-0" }) {
  const initial = (name || "").trim().charAt(0).toUpperCase() || "•";
  const showImg = Boolean(photoUrl);
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-gray-100 text-gray-700 ${sizeClass} ${ringClass}`}
      title={name}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name || "avatar"}
          className="rounded-full object-cover h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="font-semibold text-sm">{initial}</span>
      )}
    </div>
  );
}


import React from "react";

// Server component: fetch data and pass to client component
async function fetchTicket(id) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/tickets/${id}`, {
    cache: "no-store",
    // Fallback to relative URL in runtime where base not defined
    next: { revalidate: 0 }
  }).catch(() => null);

  if (res && res.ok) return res.json();

  // Relative fetch as fallback for environments where absolute not set
  const rel = await fetch(`/api/tickets/${id}`, { cache: "no-store" }).catch(() => null);
  if (rel && rel.ok) return rel.json();

  return null;
}

async function fetchDepartments(campus) {
  if (!campus) return {};
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/departments/${encodeURIComponent(campus)}`, {
    cache: "no-store",
    next: { revalidate: 0 }
  }).catch(() => null);

  let rows = [];
  if (res && res.ok) rows = await res.json();
  if ((!res || !res.ok) && typeof window === "undefined") {
    const rel = await fetch(`/api/departments/${encodeURIComponent(campus)}`, { cache: "no-store" }).catch(() => null);
    if (rel && rel.ok) rows = await rel.json();
  }
  const grouped = Array.isArray(rows)
    ? rows.reduce((acc, dept) => {
        if (!acc[dept.department_name]) acc[dept.department_name] = [];
        acc[dept.department_name].push(dept);
        return acc;
      }, {})
    : {};
  return grouped;
}

export default async function TicketDetailPage({ params }) {
  const id = params?.id;
  const ticket = await fetchTicket(id);
  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-screen-md w-full bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <div className="font-title text-2xl text-[#E94E1B] mb-2">Folio no encontrado</div>
            <a href="/" className="inline-block mt-2 text-[#004E66] underline">Volver al inicio</a>
          </div>
        </div>
      </div>
    );
  }
  const departments = await fetchDepartments(ticket.school_code || ticket.campus || "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-brand-gradient text-white shadow">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <a href="/" className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-2 text-white">← Volver</a>
            <div className="font-title text-lg">Detalle de Ficha</div>
            <div />
          </div>
        </div>
      </nav>
      <main className="max-w-screen-xl mx-auto px-4 py-6">
        <TicketDetailClient
          ticket={ticket}
          departments={departments}
        />
      </main>
    </div>
  );
}

// Client component is imported inline to avoid extra file; Next will treat it as client via directive.

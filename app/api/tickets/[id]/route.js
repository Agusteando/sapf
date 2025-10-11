
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const id = params.id;
    console.log("[api/tickets/:id][GET] id:", id);
    const connection = await getConnection();

    const [tickets] = await connection.execute(
      'SELECT *, LPAD(id, 5, "0") as folio_number FROM fichas_atencion WHERE id = ?',
      [id]
    );

    if (!tickets || tickets.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const [followups] = await connection.execute(
      "SELECT * FROM seguimiento WHERE ticket_id = ? ORDER BY fecha ASC",
      [tickets[0].folio_number]
    );

    tickets[0].followups = followups;

    return NextResponse.json(tickets[0]);
  } catch (error) {
    console.error("[api/tickets/:id][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const id = params.id;
    const { resolution, status, target_department } = await request.json();
    console.log("[api/tickets/:id][PUT] id:", id, { status, target_department });

    const connection = await getConnection();

    await connection.execute(
      "UPDATE fichas_atencion SET resolution = ?, status = ?, updated_at = NOW() WHERE id = ?",
      [resolution, status, id]
    );

    const [tickets] = await connection.execute(
      "SELECT * FROM fichas_atencion WHERE id = ?",
      [id]
    );

    if (target_department && tickets.length > 0) {
      const ticket = tickets[0];
      const folioNumber = String(ticket.id).padStart(5, "0");

      await connection.execute(
        `INSERT INTO seguimiento (
          ticket_id, campus, contact_method, parent_name, student_name,
          phone_number, parent_email, reason, resolution, target_department,
          department_email, appointment_date, status, fecha
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          folioNumber,
          ticket.campus,
          ticket.contact_method,
          ticket.parent_name,
          ticket.student_name,
          ticket.phone_number,
          ticket.parent_email,
          ticket.reason,
          resolution,
          target_department,
          ticket.department_email,
          ticket.appointment_date,
          status,
        ]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/tickets/:id][PUT] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

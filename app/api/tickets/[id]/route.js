
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

    const folioNumber = tickets[0].folio_number;
    const [followups] = await connection.execute(
      "SELECT * FROM seguimiento WHERE ticket_id = ? ORDER BY fecha ASC",
      [folioNumber]
    );
    console.log("[api/tickets/:id][GET] followups count:", followups?.length || 0);

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
    console.log("[api/tickets/:id][PUT] id:", id, { status, target_department, has_resolution: Boolean(resolution) });

    const connection = await getConnection();

    await connection.execute(
      "UPDATE fichas_atencion SET resolution = ?, status = ?, updated_at = NOW() WHERE id = ?",
      [resolution, status, id]
    );

    const [tickets] = await connection.execute(
      "SELECT *, LPAD(id, 5, '0') as folio_number FROM fichas_atencion WHERE id = ?",
      [id]
    );

    if (target_department && tickets.length > 0) {
      const ticket = tickets[0];
      const folioNumber = ticket.folio_number;

      await connection.execute(
        `INSERT INTO seguimiento (
          ticket_id,
          fecha,
          parent_name,
          reason,
          resolution,
          campus,
          contact_method,
          department_email,
          status,
          target_department,
          is_complaint,
          appointment_date,
          student_name,
          phone_number,
          parent_email,
          school_code
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          folioNumber,
          ticket.parent_name,
          ticket.reason,
          resolution,
          ticket.campus,
          ticket.contact_method,
          ticket.department_email,
          status,
          target_department,
          ticket.is_complaint ? 1 : 0,
          ticket.appointment_date || null,
          ticket.student_name,
          ticket.phone_number,
          ticket.parent_email,
          ticket.school_code || ticket.campus || "",
        ]
      );
      console.log("[api/tickets/:id][PUT] appended seguimiento for folio:", folioNumber);
    } else {
      console.log("[api/tickets/:id][PUT] no target_department => no seguimiento appended");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/tickets/:id][PUT] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

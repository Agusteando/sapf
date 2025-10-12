
import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { buildNormalizedCampusClause } from "@/lib/schema";
import ExcelJS from "exceljs";

export async function GET(request, context = { params: {} }) {
  const params = await context.params;
  try {
    const { searchParams } = new URL(request.url);
    const campus = searchParams.get("campus");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    console.log("[api/export-excel][GET] query:", {
      campus,
      status,
      startDate,
      endDate,
    });

    const pool = await getConnection();

    // Build dynamic WHERE with normalized campus (school_code preferred)
    const campusClause = campus
      ? await buildNormalizedCampusClause(pool, "f", campus)
      : { clause: "1=1", params: [] };

    let query = `
      SELECT 
        LPAD(f.id, 5, "0") as Folio,
        DATE_FORMAT(f.fecha, "%Y-%m-%d %H:%i") as Fecha,
        COALESCE(NULLIF(f.school_code, ""), f.campus) as Plantel,
        f.original_department as Departamento,
        f.parent_name as Padre,
        f.student_name as Alumno,
        f.contact_method as Tipo_Contacto,
        f.reason as Motivo,
        f.resolution as Resolucion,
        f.target_department as Canalizado_a,
        CASE WHEN f.status = "1" THEN "Cerrado" ELSE "Abierto" END as Estatus,
        f.created_by as Creado_por,
        f.phone_number as Telefono,
        f.parent_email as Email
      FROM fichas_atencion f
      WHERE ${campusClause.clause}
    `;
    const qParams = [...campusClause.params];

    if (status && status !== "") {
      query += " AND f.status = ?";
      qParams.push(status);
    }
    if (startDate) {
      query += " AND f.fecha >= ?";
      qParams.push(startDate);
    }
    if (endDate) {
      query += " AND f.fecha <= ?";
      qParams.push(endDate);
    }

    query += " ORDER BY f.fecha DESC";

    console.log("[api/export-excel] SQL:", query.replace(/\s+/g, " ").trim());
    console.log("[api/export-excel] params:", qParams);

    const [rows] = await pool.execute(query, qParams);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Fichas de Atención");

    if (rows.length > 0) {
      worksheet.columns = Object.keys(rows[0]).map((key) => ({
        header: key,
        key: key,
        width: 22,
      }));

      rows.forEach((row) => worksheet.addRow(row));

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
      worksheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFF9234" },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=fichas_${campus || "todos"}_${Date.now()}.xlsx`,
      },
    });
  } catch (error) {
    console.error("[api/export-excel][GET] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

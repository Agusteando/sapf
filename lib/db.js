// lib/db.js
import mysql from "mysql2/promise";

let pool = null;

export async function getConnection() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      timezone: "+00:00",
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    console.log("[lib/db] MySQL pool created");
  }
  return pool;
}

export async function query(sql, params = []) {
  const pool = await getConnection();
  const [results] = await pool.execute(sql, params);
  return results;
}

// Optional: graceful shutdown
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[lib/db] MySQL pool closed");
  }
}
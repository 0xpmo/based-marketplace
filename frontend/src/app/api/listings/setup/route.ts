import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

// Create a temporary connection pool for setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

export async function GET(request: NextRequest) {
  try {
    // Read the schema.sql file
    const schemaPath = path.join(process.cwd(), "db", "schema.sql");
    let schemaSQL;

    try {
      schemaSQL = fs.readFileSync(schemaPath, "utf8");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: `Could not read schema file: ${errorMessage}` },
        { status: 500 }
      );
    }

    // Execute the SQL to set up the tables
    try {
      await pool.query(schemaSQL);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        { error: `Error executing schema SQL: ${errorMessage}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Database schema initialized successfully",
    });
  } catch (error) {
    console.error("Error setting up database:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to set up database: ${errorMessage}` },
      { status: 500 }
    );
  } finally {
    // End the temporary pool connection
    await pool.end();
  }
}

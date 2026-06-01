import { NextRequest, NextResponse } from "next/server";
import { syncToSheets } from "@/lib/sheets-sync";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const clearSheet = formData.get("clearSheet") === "true";

    const result = await syncToSheets(clearSheet);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Sheets API error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload to Google Sheets";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

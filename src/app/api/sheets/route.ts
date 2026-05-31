import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import connectDB from "@/lib/mongodb";
import Job from "@/models/Job";

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const sheetUrl = formData.get("sheetUrl") as string | null;
    const serviceAccountFile = formData.get("serviceAccount") as File | null;

    if (!sheetUrl) {
      return NextResponse.json(
        { error: "Google Sheet URL is required" },
        { status: 400 }
      );
    }

    if (!serviceAccountFile) {
      return NextResponse.json(
        { error: "Service Account JSON file is required" },
        { status: 400 }
      );
    }

    const clearSheet = formData.get("clearSheet") === "true";

    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      return NextResponse.json(
        { error: "Invalid Google Sheet URL" },
        { status: 400 }
      );
    }

    const saBytes = await serviceAccountFile.arrayBuffer();
    const serviceAccount = JSON.parse(new TextDecoder().decode(saBytes));

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await connectDB();
    const jobs = await Job.find().sort({ uploadedAt: -1 }).lean();

    if (jobs.length === 0) {
      return NextResponse.json({ error: "No jobs to upload" }, { status: 400 });
    }

    const headers = [
      "Title",
      "Description",
      "Client Name",
      "Platform",
      "Job Link",
      "Budget",
      "Posted Time",
      "Required Tools",
      "Relevance Reason",
      "Urgency",
      "Fit Score",
      "Service Category",
      "Uploaded At",
    ];

    if (clearSheet) {
      // Clear all data and rewrite headers
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId: sheetId,
          range: "Sheet1",
        });
      } catch {
        // ignore clear errors
      }
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    } else {
      // Try to read first row to check if headers exist
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: "Sheet1!A1:A1",
        });
        const existing = response.data.values;
        if (!existing || existing.length === 0 || !existing[0][0]) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Sheet1!A1",
            valueInputOption: "RAW",
            requestBody: { values: [headers] },
          });
        }
      } catch {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: "Sheet1!A1",
          valueInputOption: "RAW",
          requestBody: { values: [headers] },
        });
      }
    }

    const rows = jobs.map((job: any) => [
      job.title,
      job.description || "",
      job.clientName || "",
      job.platform || "Upwork",
      job.jobLink,
      job.budget || "",
      job.postedTime || "",
      job.requiredTools || "",
      job.relevanceReason || "",
      job.urgency || "Medium",
      job.fitScore || "",
      job.serviceCategory || "",
      new Date(job.uploadedAt).toLocaleString(),
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: rows,
      },
    });

    return NextResponse.json({
      success: true,
      uploaded: jobs.length,
    });
  } catch (error: any) {
    console.error("Sheets API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload to Google Sheets" },
      { status: 500 }
    );
  }
}

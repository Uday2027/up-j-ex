import { google } from "googleapis";
import { readFileSync } from "fs";
import { join } from "path";
import connectDB from "./mongodb";
import Job from "@/models/Job";

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function getAuth() {
  const serviceAccountPath = join(process.cwd(), "service-account.json");
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

  return new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function syncToSheets(clearSheet = false) {
  const sheetUrl = process.env.GOOGLE_SHEET_URL;
  if (!sheetUrl) {
    throw new Error("GOOGLE_SHEET_URL not configured");
  }

  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    throw new Error("Invalid Google Sheet URL");
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  await connectDB();
  const jobs = await Job.find().sort({ uploadedAt: -1 }).lean();

  if (jobs.length === 0) {
    throw new Error("No jobs to upload");
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
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: "Sheet1",
      });
    } catch {
      // ignore
    }
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  } else {
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

  const rows = jobs.map((job) => [
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
    requestBody: { values: rows },
  });

  return { uploaded: jobs.length };
}

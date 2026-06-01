import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import connectDB from "@/lib/mongodb";
import Job from "@/models/Job";

export async function GET() {
  try {
    await connectDB();
    const jobs = await Job.find().sort({ uploadedAt: -1 }).lean();

    const data = jobs.map((job) => ({
      Title: job.title,
      Description: job.description || "",
      "Client Name": job.clientName || "",
      Platform: job.platform || "Upwork",
      "Job Link": job.jobLink,
      Budget: job.budget || "",
      "Posted Time": job.postedTime || "",
      "Required Tools": job.requiredTools || "",
      "Relevance Reason": job.relevanceReason || "",
      Urgency: job.urgency || "Medium",
      "Fit Score": job.fitScore || "",
      "Service Category": job.serviceCategory || "",
      "Uploaded At": new Date(job.uploadedAt).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PlugWheel Jobs");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="plugwheel_jobs.xlsx"',
      },
    });
  } catch (error) {
    console.error("Export API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

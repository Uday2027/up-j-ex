import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Job from "@/models/Job";

export async function GET() {
  try {
    await connectDB();
    const jobs = await Job.find().sort({ uploadedAt: -1 }).lean();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Jobs API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

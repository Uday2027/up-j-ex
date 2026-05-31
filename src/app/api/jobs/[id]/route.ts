import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Job from "@/models/Job";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const result = await Job.findByIdAndDelete(id);

    if (!result) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Job deleted" });
  } catch (error: any) {
    console.error("Delete API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

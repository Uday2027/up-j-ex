import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  title: string;
  description: string;
  clientName?: string;
  platform: string;
  jobLink: string;
  budget?: string;
  postedTime?: string;
  requiredTools?: string;
  relevanceReason?: string;
  urgency?: "High" | "Medium" | "Low";
  fitScore?: number;
  serviceCategory?: string;
  uploadedAt: Date;
}

const JobSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  clientName: { type: String, default: "" },
  platform: { type: String, default: "Upwork" },
  jobLink: { type: String, required: true },
  budget: { type: String, default: "" },
  postedTime: { type: String, default: "" },
  requiredTools: { type: String, default: "" },
  relevanceReason: { type: String, default: "" },
  urgency: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
  fitScore: { type: Number, min: 1, max: 10, default: 5 },
  serviceCategory: { type: String, default: "" },
  uploadedAt: { type: Date, default: Date.now },
});

JobSchema.index({ jobLink: 1 }, { unique: true });

export default mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);

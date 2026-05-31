import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import connectDB from "@/lib/mongodb";
import Job from "@/models/Job";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function cleanHtml(html: string): string {
  // If the page has a job detail slider/modal, extract ONLY that section
  // This prevents extracting background search results when viewing a single job
  const lastSliderIdx = html.lastIndexOf('class="details-slider');
  if (lastSliderIdx !== -1) {
    html = html.slice(lastSliderIdx);
  }

  let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  cleaned = cleaned.replace(/class="[^"]*"/g, "");
  cleaned = cleaned.replace(/style="[^"]*"/g, "");
  cleaned = cleaned.replace(/data-v-[a-z0-9]+/g, "");
  return cleaned;
}

const SYSTEM_PROMPT = `You are a job extraction assistant for PlugWheel, an automation agency.

IMPORTANT: If the HTML contains a job detail view, modal, or slider (usually marked with classes like "details-slider", "job-details", or similar), extract ONLY that single primary job. Do NOT extract background search results or other jobs from the page.
If there is NO detail view/modal, then extract all job listings from the search results.

Extract ONLY job listings that are directly relevant to PlugWheel's service focus.

Relevant job categories include:
- Workflow automation
- Business process automation
- AI automation
- n8n automation
- Make.com automation
- Zapier automation
- Airtable automation
- Google Sheets automation
- CRM automation
- API integration
- Webhook automation
- Data scraping
- Web scraping
- Browser automation
- Playwright, Puppeteer, Selenium, or browser-based bots
- Lead generation automation
- Internal tools automation
- Operations automation
- WhatsApp, email, or CRM workflow automation

Strict filtering rules:
- Include a job only if the main task clearly involves automation, workflow building, integrations, scraping, browser automation, or business process improvement.
- Skip the job entirely if it is mostly about: general web development, mobile app development, UI/UX design, graphic design, SEO content writing, manual data entry, virtual assistant work without automation, social media management, generic software development with no automation angle, customer support, academic research, blockchain/crypto/trading bots unless browser automation or workflow automation is clearly involved.
- Do not include loosely related jobs. The job must be a strong fit for PlugWheel's automation agency positioning.

For each accepted job, extract the following fields:
- title: Job title
- clientName: Client name, if available (empty string if not found)
- platform: "Upwork" (or source platform if different)
- jobLink: Full job URL
- budget: Budget or hourly rate (empty string if not found)
- postedTime: Posted time or date (empty string if not found)
- requiredTools: Required tools or technologies, comma-separated (empty string if not found)
- relevanceReason: Short reason why this job is relevant to PlugWheel
- urgency: Urgency level - must be exactly "High", "Medium", or "Low"
- fitScore: Fit score from 1 to 10 (integer)
- serviceCategory: Must be exactly one of: "Workflow Automation", "Revenue Ops Automation", "Browser Automation and Scraping", "AI Agent or Internal Tool", "CRM or App Integration"

If a job does not match the criteria, do not mention it at all.
Output only the accepted job listings in a clean structured format.
Return ONLY a valid JSON array. Do not include markdown formatting, rejected jobs, explanations, or extra commentary.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      return NextResponse.json(
        { error: "Only HTML files are allowed" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const html = new TextDecoder().decode(bytes);
    const cleanedHtml = cleanHtml(html);

    const maxChars = 350000;
    const truncatedHtml =
      cleanedHtml.length > maxChars
        ? cleanedHtml.slice(0, maxChars) + "\n...[truncated]"
        : cleanedHtml;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Extract all relevant job listings from this Upwork HTML:\n\n${truncatedHtml}`,
        },
      ],
      temperature: 0.2,
    });

    const rawContent = completion.choices[0].message.content || "[]";
    let jobs: Array<{
      title: string;
      clientName?: string;
      platform?: string;
      jobLink: string;
      budget?: string;
      postedTime?: string;
      requiredTools?: string;
      relevanceReason?: string;
      urgency?: string;
      fitScore?: number;
      serviceCategory?: string;
    }>;

    try {
      const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)```|```\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[2]) : rawContent;
      jobs = JSON.parse(jsonString.trim());
    } catch (e) {
      console.error("Failed to parse OpenAI response:", rawContent);
      return NextResponse.json(
        { error: "Failed to parse extracted data from LLM" },
        { status: 500 }
      );
    }

    if (!Array.isArray(jobs)) {
      return NextResponse.json(
        { error: "Invalid data format from LLM" },
        { status: 500 }
      );
    }

    await connectDB();

    let inserted = 0;
    let duplicates = 0;

    for (const job of jobs) {
      try {
        let link = job.jobLink || "";
        if (link && !link.startsWith("http")) {
          link = "https://www.upwork.com" + link;
        }

        let urgency = job.urgency || "Medium";
        if (!["High", "Medium", "Low"].includes(urgency)) urgency = "Medium";

        let fitScore = Number(job.fitScore) || 5;
        if (fitScore < 1) fitScore = 1;
        if (fitScore > 10) fitScore = 10;

        const validCategories = [
          "Workflow Automation",
          "Revenue Ops Automation",
          "Browser Automation and Scraping",
          "AI Agent or Internal Tool",
          "CRM or App Integration",
        ];
        let serviceCategory = job.serviceCategory || "";
        if (!validCategories.includes(serviceCategory)) serviceCategory = "";

        await Job.create({
          title: job.title || "Untitled",
          clientName: job.clientName || "",
          platform: job.platform || "Upwork",
          jobLink: link,
          budget: job.budget || "",
          postedTime: job.postedTime || "",
          requiredTools: job.requiredTools || "",
          relevanceReason: job.relevanceReason || "",
          urgency,
          fitScore,
          serviceCategory,
        });
        inserted++;
      } catch (err: any) {
        if (err.code === 11000) {
          duplicates++;
        } else {
          console.error("Error inserting job:", err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      extracted: jobs.length,
      inserted,
      duplicates,
    });
  } catch (error: any) {
    console.error("Extract API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

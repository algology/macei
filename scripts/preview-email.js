// Script for generating and previewing email templates without sending them
import dotenv from "dotenv";
import { previewEmail } from "../lib/emailServicePreview.js";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

// Get any command line arguments
const args = process.argv.slice(2);
const params = {};

// Parse command line arguments in the format --key=value
args.forEach((arg) => {
  if (arg.startsWith("--")) {
    const [key, value] = arg.substring(2).split("=");
    params[key] = value;
  }
});

// Generate and preview the email
previewEmail(
  params.userName || "MACY User",
  params.ideaName || "Sample Idea",
  parseInt(params.briefingId || "123"),
  params.summary ||
    "This is a test briefing summary for your idea. It contains market intelligence and insights about your idea's viability.",
  params.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
);

console.log("Email preview generated and opened in your browser.");
console.log("To customize the preview, use command line arguments:");
console.log(
  'node scripts/preview-email.js --userName="John Doe" --ideaName="AI Project" --briefingId=456 --summary="Custom summary text"'
);

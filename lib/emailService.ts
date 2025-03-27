import FormData from "form-data";
import fetch from "node-fetch";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Send email using Mailgun API directly
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: EmailOptions): Promise<boolean> {
  try {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;

    if (!apiKey || !domain) {
      console.error(
        "Missing Mailgun API key or domain in environment variables"
      );
      return false;
    }

    // Create multipart form data
    const form = new FormData();
    form.append(
      "from",
      `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`
    );
    form.append("to", to);
    form.append("subject", subject);
    form.append("html", html);

    if (text) {
      form.append("text", text);
    } else {
      form.append("text", html.replace(/<[^>]*>?/gm, ""));
    }

    // Send the request to Mailgun API
    const auth = Buffer.from(`api:${apiKey}`).toString("base64");

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
        },
        // @ts-ignore - Type issues with FormData
        body: form,
      }
    );

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      console.error("Mailgun API error:", result);
      return false;
    }

    console.log(`Email sent to ${to} via Mailgun API`);
    return true;
  } catch (error) {
    console.error("Error sending via Mailgun API:", error);
    return false;
  }
}

export function generateBriefingEmail(
  userName: string,
  ideaName: string,
  briefingId: number,
  briefingSummary: string,
  siteUrl: string
): string {
  // Create a nicely formatted HTML email that matches the MACY website
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Briefing Note Available</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #213547; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .logo { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
        .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
        h1 { font-weight: 600; font-size: 20px; margin-bottom: 20px; color: #111827; }
        h3 { font-weight: 600; font-size: 16px; margin-top: 24px; color: #111827; }
        p { margin-bottom: 16px; font-size: 15px; color: #4b5563; }
        .button { display: inline-block; background-color: #213547; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: 500; font-size: 14px; }
        .button:hover { background-color: #2c4a6c; }
        .footer { margin-top: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
        strong { color: #111827; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">MACY</div>
      </div>
      <div class="content">
        <h1>New Briefing Note Available</h1>
        <p>Hello ${userName},</p>
        <p>A new weekly briefing note has been generated for your idea: <strong>${ideaName}</strong>.</p>
        <h3>Summary</h3>
        <p>${briefingSummary}</p>
        <a href="${siteUrl}/dashboard" class="button">View Full Briefing</a>
        <p>This briefing note was automatically generated as part of your weekly market intelligence update.</p>
      </div>
      <div class="footer">
        <p>This is an automated email from MACY. Please do not reply to this email.</p>
        <p>If you no longer wish to receive these notifications, you can update your preferences in your account settings.</p>
      </div>
    </body>
    </html>
  `;
}

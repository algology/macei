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
  // Create an email-compatible HTML template with inline styles
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>MACY Email Template</title>
    </head>
    <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #333333; background-color: #f5f5f5; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #0c0c0c; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <img src="${siteUrl}/logo.png" alt="MACY Logo" width="120" style="margin: 0 auto;" />
        </div>
        <div style="background-color: #0c0c0c; padding: 32px 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 8px 16px; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 9999px; font-size: 12px; color: #9ca3af; font-family: monospace;">NEW BRIEFING</div>
          </div>
          <h1 style="font-weight: 600; font-size: 28px; margin: 0 0 24px 0; color: #ffffff; line-height: 1.2; text-align: center;">
            Market Intelligence Update for
            <span style="color: #22c55e; font-weight: bold;">${ideaName}</span>
          </h1>

          <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">Hello ${userName},</p>
          <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
            We've analyzed the latest market signals and generated a new briefing
            note for your idea. This intelligence update contains the most relevant
            market movements and opportunities.
          </p>

          <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; margin-top: 24px;">
            <div style="font-weight: 600; font-size: 18px; margin-bottom: 12px; color: #ffffff;">Summary</div>
            <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">${briefingSummary}</p>
          </div>

          <div style="text-align: center; margin-top: 32px;">
            <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #22c55e; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: 500; font-size: 16px; text-align: center;">View Full Briefing</a>
          </div>

          <div style="display: flex; align-items: center; margin: 24px 0; color: #9ca3af; font-size: 14px; text-align: center;">
            <div style="flex: 1; height: 1px; background-color: rgba(255,255,255,0.1); margin-right: 16px;"></div>
            AI-Powered Analysis
            <div style="flex: 1; height: 1px; background-color: rgba(255,255,255,0.1); margin-left: 16px;"></div>
          </div>

          <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
            This briefing note was automatically generated using our AI-powered
            market intelligence system. It analyzes market signals, research papers,
            and industry trends to help you validate your ideas with confidence.
          </p>
        </div>
        <div style="padding: 24px 20px; font-size: 14px; color: #9ca3af; text-align: center; background-color: #0c0c0c; border-radius: 0 0 8px 8px;">
          <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
            This is an automated email from MACY. Please do not reply to this email.
          </p>
          <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
            If you no longer wish to receive these notifications, you can update
            your preferences in your account settings.
          </p>
          <img
            src="${siteUrl}/11point2logo.png"
            alt="11point2 Logo"
            width="120"
            style="opacity: 0.6; margin-top: 16px;"
          />
        </div>
      </div>
    </body>
    </html>
  `;
}

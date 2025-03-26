import nodemailer from "nodemailer";

// Initialize nodemailer with environment variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: EmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ""), // Strip HTML tags for text version
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
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
  // Create a nicely formatted HTML email
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Briefing Note Available</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #213547; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; background-color: #213547; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>New Briefing Note Available</h1>
      </div>
      <div class="content">
        <p>Hello ${userName},</p>
        <p>A new weekly briefing note has been generated for your idea: <strong>${ideaName}</strong>.</p>
        <h3>Summary</h3>
        <p>${briefingSummary}</p>
        <a href="${siteUrl}/dashboard/ideas/${briefingId}" class="button">View Full Briefing</a>
        <p>This briefing note was automatically generated as part of your weekly market intelligence update.</p>
      </div>
      <div class="footer">
        <p>This is an automated email from MACEI. Please do not reply to this email.</p>
        <p>If you no longer wish to receive these notifications, you can update your preferences in your account settings.</p>
      </div>
    </body>
    </html>
  `;
}

// Simple script to test if the email sending works
import { sendEmail } from "../lib/emailService.js";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

async function testEmailSending() {
  try {
    console.log("Attempting to send test email...");
    console.log(
      "Sending to:",
      process.env.ADMIN_EMAIL || "paxmoderationai@gmail.com"
    );

    const result = await sendEmail({
      to: process.env.ADMIN_EMAIL || "paxmoderationai@gmail.com",
      subject: "Test Email from MACY",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Test Email from MACY</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #374151; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #213547; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
            .logo { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 5px 5px; }
            h1 { font-weight: 600; font-size: 20px; margin-bottom: 20px; color: #111827; }
            p { margin-bottom: 16px; font-size: 15px; color: #4b5563; }
            .button { display: inline-block; background-color: #213547; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px; font-weight: 500; font-size: 14px; }
            .button:hover { background-color: #2c4a6c; }
            .footer { margin-top: 30px; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">MACY</div>
          </div>
          <div class="content">
            <h1>Test Email</h1>
            <p>This is a test email to verify that the email sending functionality works.</p>
            <p>Sent at: ${new Date().toISOString()}</p>
            <a href="${
              process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
            }/dashboard" class="button">Open Dashboard</a>
          </div>
          <div class="footer">
            <p>This is an automated email from MACY. Please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sending result:", result);
    console.log("If true, the email was sent successfully.");
  } catch (error) {
    console.error("Error sending test email:", error);
  }
}

testEmailSending();

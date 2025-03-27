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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const result = await sendEmail({
      to: process.env.ADMIN_EMAIL || "paxmoderationai@gmail.com",
      subject: "Test Email from MACY",
      html: `
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
                <div style="display: inline-block; padding: 8px 16px; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 9999px; font-size: 12px; color: #9ca3af; font-family: monospace;">TEST EMAIL</div>
              </div>
              <h1 style="font-weight: 600; font-size: 28px; margin: 0 0 24px 0; color: #ffffff; line-height: 1.2; text-align: center;">
                MACY Email System 
                <span style="color: #22c55e; font-weight: bold;">Test</span>
              </h1>

              <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">Hello MACY User,</p>
              <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
                This is a test email to verify that the email sending functionality works correctly.
                If you're receiving this, our email system is properly configured.
              </p>

              <div style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; margin-top: 24px;">
                <div style="font-weight: 600; font-size: 18px; margin-bottom: 12px; color: #ffffff;">Test Details</div>
                <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">Sent at: ${new Date().toISOString()}</p>
              </div>

              <div style="text-align: center; margin-top: 32px;">
                <a href="${siteUrl}/dashboard" style="display: inline-block; background-color: #22c55e; color: #000000; padding: 12px 24px; text-decoration: none; border-radius: 9999px; font-weight: 500; font-size: 16px; text-align: center;">Go to Dashboard</a>
              </div>

              <div style="display: flex; align-items: center; margin: 24px 0; color: #9ca3af; font-size: 14px; text-align: center;">
                <div style="flex: 1; height: 1px; background-color: rgba(255,255,255,0.1); margin-right: 16px;"></div>
                System Information
                <div style="flex: 1; height: 1px; background-color: rgba(255,255,255,0.1); margin-left: 16px;"></div>
              </div>

              <p style="margin-bottom: 16px; font-size: 16px; color: #9ca3af; line-height: 1.6;">
                The MACY email notification system is ready to send automated briefing updates
                and other important notifications.
              </p>
            </div>
            <div style="padding: 24px 20px; font-size: 14px; color: #9ca3af; text-align: center; background-color: #0c0c0c; border-radius: 0 0 8px 8px;">
              <p style="margin-bottom: 16px; font-size: 14px; color: #9ca3af; line-height: 1.6;">
                This is a test email from MACY. Please do not reply to this email.
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
      `,
    });

    console.log("Email sending result:", result);
    console.log("If true, the email was sent successfully.");
  } catch (error) {
    console.error("Error sending test email:", error);
  }
}

testEmailSending();

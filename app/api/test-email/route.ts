import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/emailService";
import nodemailer from "nodemailer";

// Simple endpoint to test email sending functionality with enhanced error reporting
export async function GET(request: Request) {
  try {
    // Check for an API key for security
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    // Only allow with a valid API key (use the CRON_API_KEY for simplicity)
    if (key !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recipient =
      searchParams.get("email") ||
      process.env.ADMIN_EMAIL ||
      "paxmoderationai@gmail.com";

    console.log(`Attempting to send test email to ${recipient}...`);

    // Log the email configuration for debugging
    const emailConfig = {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        // Not logging password for security reasons
      },
      from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
    };

    console.log("Email configuration:", {
      ...emailConfig,
      auth: { user: emailConfig.auth.user },
    });

    // Try to verify SMTP connection
    try {
      const testTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
        secure: process.env.EMAIL_SECURE === "true",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

      console.log("Testing SMTP connection...");
      const verifyResult = await testTransporter.verify();
      console.log("SMTP connection verified:", verifyResult);
    } catch (smtpError: any) {
      console.error("SMTP verification failed:", smtpError);
    }

    // Send a test email
    let emailError: any = null;
    const result = await sendEmail({
      to: recipient,
      subject: "Test Email from MACEI",
      html: `
        <h1>Test Email</h1>
        <p>This is a test email to verify that the email sending functionality works.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
        <p>This email was sent via the /api/test-email endpoint.</p>
      `,
    }).catch((err) => {
      emailError = err;
      return false;
    });

    if (emailError) {
      console.error("Detailed email sending error:", emailError);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to send test email to ${recipient}`,
          error: emailError.message || "Unknown error",
          stack: emailError.stack,
          code: emailError.code,
          command: emailError.command,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${recipient}`,
      emailResult: result,
      config: {
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        user: emailConfig.auth.user,
        from: emailConfig.from,
      },
    });
  } catch (error: any) {
    console.error("Error sending test email:", error);
    return NextResponse.json(
      {
        error: "Failed to send test email",
        message: error.message || "Unknown error",
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

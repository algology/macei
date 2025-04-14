import { NextResponse } from "next/server";

// Test Mailgun API directly
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

    console.log(
      `Attempting to send test email to ${recipient} using Mailgun API directly...`
    );

    // Prepare Mailgun API parameters
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const from = `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`;

    if (!apiKey || !domain) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing Mailgun API key or domain in environment variables",
        },
        { status: 500 }
      );
    }

    console.log("Mailgun configuration:");
    console.log("- Domain:", domain);
    console.log("- From:", from);
    console.log("- API Key:", apiKey ? "Present (hidden)" : "Missing");

    // Create URLSearchParams for form data (simpler than FormData for fetch)
    const formData = new URLSearchParams();
    formData.append("from", from);
    formData.append("to", recipient);
    formData.append("subject", "Mailgun API Test");
    formData.append("text", "Testing Mailgun API directly from Next.js");
    formData.append(
      "html",
      `
      <h1>Mailgun API Test</h1>
      <p>This is a test email sent directly via the Mailgun API.</p>
      <p>Time: ${new Date().toISOString()}</p>
    `
    );

    // Send the request to Mailgun API
    const auth = Buffer.from(`api:${apiKey}`).toString("base64");

    const response = await fetch(
      `https://api.mailgun.net/v3/${domain}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Failed to send email via Mailgun API: ${response.statusText}`,
          result,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${recipient} using Mailgun API`,
      result,
    });
  } catch (error: any) {
    console.error("Error using Mailgun API:", error);
    return NextResponse.json(
      {
        error: "Failed to send test email via Mailgun API",
        message: error.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}

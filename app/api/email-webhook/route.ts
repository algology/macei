import { NextResponse } from "next/server";

// This endpoint will receive webhook calls from your email service provider
// (Mailgun, SendGrid, etc.) when an email is received
export async function POST(request: Request) {
  try {
    // Parse the webhook payload - format depends on your email provider
    const webhookData = await request.json();

    // Extract email data - this structure will depend on your provider
    // Here's an example format compatible with our email-to-signal processor
    const emailPayload = {
      from: webhookData.sender || webhookData.from || "",
      subject: webhookData.subject || "",
      text: webhookData.body || webhookData.text || "",
      html: webhookData.html || "",
      to: webhookData.recipient || webhookData.to || "",
      attachments: webhookData.attachments || [],
    };

    // Verify webhook authenticity (check signatures, etc.) based on your provider
    // ...

    // Forward the parsed email to our email-to-signal processor
    const response = await fetch(new URL("/api/email-to-signal", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Include appropriate internal API authentication
        "X-API-Key": process.env.INTERNAL_API_KEY || "",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to process email");
    }

    // Return success to the webhook sender
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing email webhook:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process email webhook",
      },
      { status: 500 }
    );
  }
}

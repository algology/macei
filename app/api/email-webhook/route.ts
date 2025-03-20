import { NextResponse } from "next/server";

// Define the interface for email attachments
interface EmailAttachment {
  filename: string;
  contentType: string;
  content: string;
}

// Define the interface for the email payload
interface EmailPayload {
  from: string;
  subject: string;
  text: string;
  html: string;
  to: string;
  attachments: EmailAttachment[];
}

// This endpoint will receive webhook calls from your email service provider
// (Mailgun, SendGrid, etc.) when an email is received
export async function POST(request: Request) {
  try {
    console.log("Received webhook request from Mailgun");

    // Mailgun sends data as form data, not JSON
    const formData = await request.formData();

    // Log the received data for debugging
    console.log(
      "Webhook data received:",
      Object.fromEntries(formData.entries())
    );

    // Extract email data from Mailgun's format
    const emailPayload: EmailPayload = {
      from:
        (formData.get("sender") as string) ||
        (formData.get("From") as string) ||
        "",
      subject:
        (formData.get("subject") as string) ||
        (formData.get("Subject") as string) ||
        "",
      text:
        (formData.get("body-plain") as string) ||
        (formData.get("stripped-text") as string) ||
        "",
      html:
        (formData.get("body-html") as string) ||
        (formData.get("stripped-html") as string) ||
        "",
      to:
        (formData.get("recipient") as string) ||
        (formData.get("To") as string) ||
        "",
      attachments: [],
    };

    console.log("Processed email payload:", emailPayload);

    // Process attachments if any
    const attachmentCount = parseInt(
      (formData.get("attachment-count") as string) || "0"
    );
    if (attachmentCount > 0) {
      for (let i = 1; i <= attachmentCount; i++) {
        const attachment = formData.get(`attachment-${i}`) as File;
        if (attachment) {
          try {
            const buffer = await attachment.arrayBuffer();
            const base64Content = Buffer.from(buffer).toString("base64");

            emailPayload.attachments.push({
              filename: attachment.name,
              contentType: attachment.type,
              content: base64Content,
            });
          } catch (error) {
            console.error("Error processing attachment:", error);
          }
        }
      }
    }

    // Forward the parsed email to our email-to-signal processor
    console.log("Forwarding to email-to-signal processor");
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

    const responseData = await response.json();
    console.log("Email processed successfully:", responseData);

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

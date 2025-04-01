import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { parse } from "node-html-parser";
import { convert } from "html-to-text";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface EmailPayload {
  from: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string; // Base64 encoded
  }>;
  to: string; // Format: idea-{ideaId}@macei.app
}

export async function POST(request: Request) {
  try {
    console.log("Email-to-signal processor: Started processing");

    // Check internal API key for security (optional but recommended)
    const apiKey = request.headers.get("X-API-Key");
    if (
      process.env.INTERNAL_API_KEY &&
      apiKey !== process.env.INTERNAL_API_KEY
    ) {
      console.log("Unauthorized access attempt - missing or invalid API key");
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    // Get the email payload from the request
    const payload: EmailPayload = await request.json();
    console.log("Received payload:", {
      subject: payload.subject,
      from: payload.from,
      to: payload.to,
      textLength: payload.text?.length || 0,
      htmlLength: payload.html?.length || 0,
      attachments: payload.attachments?.length || 0,
    });

    // Extract idea ID from the email address
    const ideaIdMatch = payload.to.match(/idea-(\d+)@/);
    if (!ideaIdMatch) {
      console.error("Invalid target email address:", payload.to);
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    const ideaId = parseInt(ideaIdMatch[1], 10);
    console.log(`Processing email for idea: ${ideaId}`);

    // Initialize supabase with service role
    const supabase = getServerSupabase();

    // Get idea details
    const { data: idea, error: ideaError } = await supabase
      .from("ideas")
      .select(
        `
        *,
        mission:missions (
          *,
          organization:organizations (*)
        )
      `
      )
      .eq("id", ideaId)
      .single();

    if (ideaError) {
      console.error("Error fetching idea:", ideaError);
      return NextResponse.json(
        { error: "Failed to find the specified idea" },
        { status: 404 }
      );
    }

    // Extract content from the email
    let content = payload.text;
    let urls: string[] = [];

    // Extract URLs from the text - improved regex to catch www. links without http prefix
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const textUrls = payload.text.match(urlRegex) || [];
    urls = [...textUrls];

    // If HTML is available, extract URLs and rich content
    if (payload.html) {
      const root = parse(payload.html);

      // Extract URLs from anchor tags properly
      const anchorTags = root.querySelectorAll("a");
      const anchorUrls = anchorTags
        .map((a) => a.getAttribute("href"))
        .filter((href): href is string => href !== null && href !== undefined);

      // Also look for URLs in text
      const htmlUrls = payload.html.match(urlRegex) || [];

      // Combine all URLs and deduplicate
      urls = [...new Set([...urls, ...anchorUrls, ...htmlUrls])];

      // Extract rich content from HTML using html-to-text conversion
      // This will preserve important content from forwarded emails and newsletters
      const htmlContent = convert(payload.html, {
        wordwrap: 130,
        selectors: [
          { selector: "img", format: "skip" },
          { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
        ],
        // Preserve formatting of paragraphs, lists, headers
        preserveNewlines: true,
        // Decode entities for proper text representation
        decodeEntities: true,
      });

      // Combine the plain text and HTML content
      // If HTML content is substantially longer, it likely contains more information
      if (htmlContent.length > content.length * 1.5) {
        content = htmlContent;
      } else {
        // If the HTML doesn't add much, keep the original but append any additional content
        const plainTextLines = new Set(
          content.split("\n").map((line) => line.trim())
        );
        const htmlContentLines = htmlContent.split("\n");

        // Add lines from HTML that aren't in the plain text
        for (const line of htmlContentLines) {
          const trimmedLine = line.trim();
          if (trimmedLine.length > 20 && !plainTextLines.has(trimmedLine)) {
            content += "\n" + trimmedLine;
          }
        }
      }
    }

    // Clean and normalize URLs
    urls = urls.map((url) => {
      // First remove any HTML tags completely
      let cleanUrl = url.replace(/<[^>]*>/g, "");

      // Remove closing quotes, parentheses, etc.
      cleanUrl = cleanUrl.replace(/["')\]}>]+$/g, "");

      // Add http:// prefix to www. URLs if missing
      if (cleanUrl.startsWith("www.") && !cleanUrl.match(/^https?:\/\//)) {
        cleanUrl = "http://" + cleanUrl;
      }

      // Fix common URL issues
      // Remove duplicated protocol (https://www.example.com/https://www.example.com)
      const protocolMatch = cleanUrl.match(
        /^(https?:\/\/[^\/]+)\/(https?:\/\/)/i
      );
      if (protocolMatch) {
        cleanUrl =
          protocolMatch[2] +
          cleanUrl.substring(
            protocolMatch[1].length + protocolMatch[2].length + 1
          );
      }

      // Remove any trailing HTML content
      cleanUrl = cleanUrl.split("<")[0];

      // Remove trailing punctuation
      cleanUrl = cleanUrl.replace(/[,.;:!?]+$/, "");

      return cleanUrl;
    });

    // Clean the email content - focus on keeping it simple
    // 1. Remove any quoted reply text (common in email replies)
    const cleanedContent = content
      .replace(/^\s*>.*$/gm, "") // Remove lines starting with >
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
      .trim();

    // Filter out non-web URLs and duplicates
    const webUrls = [
      ...new Set(
        urls.filter(
          (url) =>
            (url.startsWith("http://") || url.startsWith("https://")) &&
            !url.startsWith("mailto:")
        )
      ),
    ];

    // Create a signals array to process
    const signalsToProcess = [];

    // Generate a single signal from the email content with included URLs
    signalsToProcess.push({
      title: payload.subject,
      description: cleanedContent, // Use the full cleaned content without truncation
      source: payload.from,
      url:
        webUrls.length > 0
          ? webUrls[0]
          : "email://" + payload.subject.replace(/\s+/g, "-"),
      date: new Date().toISOString(),
      type: "news", // Default type
      isUserSubmitted: true,
      sentiment: "neutral", // Default sentiment
      impactLevel: "medium", // Default impact level
    });

    // Skip URL content fetching and processing - we're only keeping the original email

    // Save signals to the knowledge base
    const savedSignals = [];
    for (const signal of signalsToProcess) {
      try {
        // Check for duplicates based on URL
        const { data: existing } = await supabase
          .from("knowledge_base")
          .select("id")
          .eq("idea_id", ideaId)
          .eq("source_url", signal.url)
          .single();

        if (existing) {
          console.log(`Signal with URL ${signal.url} already exists`);
          continue;
        }

        // Map signal type to allowed database type
        function mapSourceType(type: string): string {
          const typeMap: Record<string, string> = {
            news: "news",
            academic: "academic",
            patent: "patent",
            trend: "news",
            competitor: "news",
            industry: "academic",
            funding: "news",
          };
          return typeMap[type] || "news";
        }

        // Set a higher relevance score for user-submitted signals
        // Normal signals start at 70, but user signals start at 95 (increased from 85)
        const relevanceScore = Math.min(
          100,
          95 + (signal.impactLevel === "high" ? 5 : 0)
        );

        // Create knowledge base entry
        const { data, error } = await supabase
          .from("knowledge_base")
          .insert([
            {
              idea_id: ideaId,
              title: signal.title,
              content: signal.description, // Just the cleaned email body
              source_url: signal.url,
              source_type: mapSourceType(signal.type),
              source_name: signal.source,
              publication_date: signal.date,
              relevance_score: relevanceScore,
              metadata: {
                sentiment: signal.sentiment,
                impact_level: signal.impactLevel,
                is_user_submitted: true,
                email_subject: payload.subject,
                from_email: payload.from,
                web_urls: webUrls, // Store URLs in metadata instead
              },
              last_analyzed: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (error) {
          throw error;
        }

        savedSignals.push(data);
      } catch (error) {
        console.error("Error saving signal:", error);
      }
    }

    // Skip insights generation - we're keeping it simple

    return NextResponse.json({
      success: true,
      message: `Processed ${savedSignals.length} signals from email`,
      savedSignals: savedSignals.length,
    });
  } catch (error) {
    console.error("Error processing email:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process email",
      },
      { status: 500 }
    );
  }
}

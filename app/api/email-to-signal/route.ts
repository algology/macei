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

    // Clean the email content - focus on keeping it simple
    // 1. Remove any quoted reply text (common in email replies)
    const cleanedContent = content
      .replace(/^\s*>.*$/gm, "") // Remove lines starting with >
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
      .trim();

    // Determine if content is too long and needs summarization
    const EMAIL_LENGTH_THRESHOLD = 1000; // Characters
    let contentToStore = cleanedContent;
    let summarized = false;

    // For long emails, generate a summary using LLM
    if (cleanedContent.length > EMAIL_LENGTH_THRESHOLD) {
      try {
        console.log(
          `Email content is ${cleanedContent.length} characters, generating summary...`
        );
        // Note: We're only summarizing the email body here, not the content from URLs
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are a precise, concise assistant that summarizes email content. Extract only the most important information and key points. DO NOT be repetitive. Avoid generic statements and focus on specific, unique details. Your summary should be 300-500 words, well-structured, and contain NO repetition. Present information in a clear, organized way.",
            },
            {
              role: "user",
              content: `Please summarize this email in a clear, concise way. Extract the key facts, details, and any actionable items. Be specific and avoid repetition.\n\nSubject: ${
                payload.subject
              }\n\nContent:\n${cleanedContent.substring(0, 15000)}`,
            },
          ],
          model: "gemma2-9b-it",
          temperature: 0.1, // Lower temperature for more deterministic output
          max_tokens: 800, // Slightly shorter summary
          top_p: 0.9, // Add top_p to reduce randomness
        });

        const summary = completion.choices[0]?.message?.content || "";

        // Check for summary quality
        const isRepetitive = checkForRepetitiveContent(summary);
        const hasSufficientContent = summary.length > 100;

        if (summary && hasSufficientContent && !isRepetitive) {
          contentToStore = summary;
          summarized = true;
          console.log(`Generated summary of ${summary.length} characters`);
        } else {
          // Fallback if summary generation fails or produces poor quality
          contentToStore =
            cleanedContent.substring(0, 1500) +
            (cleanedContent.length > 1500
              ? " [Content truncated due to length...]"
              : "");
          console.log(
            "Summary generation failed or returned poor quality results, using truncated content"
          );
          if (isRepetitive) {
            console.log("Detected repetitive content in summary");
          }
        }
      } catch (error) {
        console.error("Error generating summary:", error);
        // Fallback to truncation if summarization fails
        contentToStore =
          cleanedContent.substring(0, 1500) +
          (cleanedContent.length > 1500
            ? " [Content truncated due to length...]"
            : "");
      }
    }

    // Helper function to detect repetitive content in summaries
    function checkForRepetitiveContent(text: string): boolean {
      if (!text) return true;

      // Check for repeated phrases (4+ words)
      const phrases = text.match(/\b(\w+\s+\w+\s+\w+\s+\w+\s+\w+)\b/g) || [];
      const phraseCounts: Record<string, number> = {};

      for (const phrase of phrases) {
        phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
        // If any phrase appears more than 3 times, it's likely repetitive
        if (phraseCounts[phrase] > 3) {
          return true;
        }
      }

      // Check for repeated lines
      const lines = text.split("\n").filter((line) => line.trim().length > 0);
      const lineCounts: Record<string, number> = {};

      for (const line of lines) {
        lineCounts[line] = (lineCounts[line] || 0) + 1;
        // If any line appears more than 2 times, it's repetitive
        if (lineCounts[line] > 2) {
          return true;
        }
      }

      // Check for pattern of incomplete sentences ending with the same word
      const incompleteSentences = text.match(/\w+\s+\w+\s+\w+\s*$/gm) || [];
      if (incompleteSentences.length > 3) {
        return true;
      }

      return false;
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
      description: contentToStore, // Use the summary or full content depending on length
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
              content: signal.description, // Now this contains the summary for long emails
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
                original_content: summarized ? cleanedContent : undefined, // Store original content if summarized
                was_summarized: summarized,
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

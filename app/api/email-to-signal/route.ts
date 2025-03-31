import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { parse } from "node-html-parser";

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

    // Extract URLs from the text
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const textUrls = payload.text.match(urlRegex) || [];
    urls = [...textUrls];

    // If HTML is available, extract URLs and potentially more text
    if (payload.html) {
      const root = parse(payload.html);
      
      // Extract URLs from anchor tags properly
      const anchorTags = root.querySelectorAll('a');
      const anchorUrls = anchorTags
        .map(a => a.getAttribute('href'))
        .filter((href): href is string => href !== null && href !== undefined);
      
      // Also look for URLs in text
      const htmlUrls = payload.html.match(urlRegex) || [];
      
      // Combine all URLs and deduplicate
      urls = [...new Set([...urls, ...anchorUrls, ...htmlUrls])]; 
    }
    
    // Clean and normalize URLs
    urls = urls.map(url => {
      // First remove any HTML tags completely
      let cleanUrl = url.replace(/<[^>]*>/g, '');
      
      // Remove closing quotes, parentheses, etc.
      cleanUrl = cleanUrl.replace(/["')\]}>]+$/g, '');
      
      // Fix common URL issues
      // Remove duplicated protocol (https://www.example.com/https://www.example.com)
      const protocolMatch = cleanUrl.match(/^(https?:\/\/[^\/]+)\/(https?:\/\/)/i);
      if (protocolMatch) {
        cleanUrl = protocolMatch[2] + cleanUrl.substring(protocolMatch[1].length + protocolMatch[2].length + 1);
      }
      
      // Remove any trailing HTML content
      cleanUrl = cleanUrl.split('<')[0];
      
      // Remove trailing punctuation
      cleanUrl = cleanUrl.replace(/[,.;:!?]+$/, '');
      
      return cleanUrl;
    });
    
    // Deduplicate URLs again after cleaning
    urls = [...new Set(urls)];

    // Create a signals array to process
    const signalsToProcess = [];

    // Create a description that includes URLs
    const urlsText = urls.length > 0 
      ? `\n\nLinks included:\n${urls.join('\n')}`
      : '';

    // Generate a single signal from the email content with included URLs
    signalsToProcess.push({
      title: payload.subject,
      description: content.substring(0, 500) + urlsText, // Limit to a reasonable length but include URLs
      source: payload.from,
      url: "email://" + payload.subject.replace(/\s+/g, "-"),
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
              content: signal.description,
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

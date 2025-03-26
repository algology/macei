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
      const htmlText = root.textContent;

      // Look for URLs in HTML
      const htmlUrls = payload.html.match(urlRegex) || [];
      urls = [...new Set([...urls, ...htmlUrls])]; // Deduplicate
    }

    // If there are attachments, process them (we'll store image attachments)
    let imageUrls: string[] = [];
    if (payload.attachments && payload.attachments.length > 0) {
      // Process image attachments
      const imageAttachments = payload.attachments.filter((att) =>
        att.contentType.startsWith("image/")
      );

      for (const attachment of imageAttachments) {
        try {
          // Upload image to Supabase Storage
          const { data, error } = await supabase.storage
            .from("idea-documents")
            .upload(
              `idea-${ideaId}/email-attachment-${Date.now()}-${
                attachment.filename
              }`,
              Buffer.from(attachment.content, "base64"),
              {
                contentType: attachment.contentType,
                upsert: false,
              }
            );

          if (error) throw error;

          // Get public URL
          const { data: publicUrlData } = supabase.storage
            .from("idea-documents")
            .getPublicUrl(data.path);

          imageUrls.push(publicUrlData.publicUrl);
        } catch (error) {
          console.error("Error uploading attachment:", error);
        }
      }
    }

    // Create a signals array to process
    const signalsToProcess = [];

    // Generate a signal from the email content itself
    signalsToProcess.push({
      title: payload.subject,
      description: content.substring(0, 500), // Limit to a reasonable length
      source: payload.from,
      url:
        urls.length > 0
          ? urls[0]
          : "email://" + payload.subject.replace(/\s+/g, "-"),
      date: new Date().toISOString(),
      type: "news", // Default type
      isUserSubmitted: true,
    });

    // If we have URLs, create signals from each URL (limited to first 3)
    const urlsToProcess = urls.slice(0, 3);
    if (urlsToProcess.length > 0) {
      // Fetch content for each URL first
      const urlContents = await Promise.all(
        urlsToProcess.map(async (url) => {
          try {
            const response = await fetch(
              `${
                process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
              }/api/fetch-url-content`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url, priority: "high" }),
              }
            );

            if (!response.ok) {
              throw new Error(
                `Failed to fetch URL content: ${response.status}`
              );
            }

            const data = await response.json();
            return {
              url,
              content: data.content || "",
              error: data.error,
            };
          } catch (error) {
            console.error(`Error fetching content for ${url}:`, error);
            return {
              url,
              content: "",
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      // Use Groq to analyze the URLs and content
      const urlList = urlsToProcess.join("\n");
      const prompt = `
You are an expert market researcher. I need you to analyze the following URLs and content in the context of a business idea.

BUSINESS IDEA DETAILS:
Idea Name: ${idea.name}
Description: ${idea.description || "Not provided"}
Category: ${idea.category || "Not provided"}
Organization: ${idea.mission?.organization?.name || "Not provided"}
Industry: ${idea.mission?.organization?.industry || "Not provided"}

CONTENT TO ANALYZE:
Email Subject: ${payload.subject}
Email Content: ${content.substring(0, 1000)}

URLs and their content:
${urlContents
  .map((uc) => `URL: ${uc.url}\nContent: ${uc.content.substring(0, 1000)}\n`)
  .join("\n")}

For each URL, please extract important market signal information:
1. Title (short, descriptive title about this information)
2. Description (2-3 sentences summarizing key points relevant to the idea)
3. Type (categorize as one of: news, academic, patent, trend, competitor, industry, funding)
4. Source name (the publisher/website name)
5. Sentiment (positive, negative, or neutral impact on the idea)
6. Impact level (high, medium, or low)

Format your response as a JSON array with one object per URL:
[
  {
    "title": "Title of the market signal",
    "description": "Description of key points",
    "type": "news",
    "source": "Source Name",
    "sentiment": "positive",
    "impactLevel": "high"
  }
]

Always return valid JSON. Include all fields. Use "unknown" if you can't determine a value.
`;

      try {
        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          model: "mixtral-8x7b-32768",
          temperature: 0.5,
          max_tokens: 2048,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          try {
            // Extract JSON if it's wrapped in markdown
            let jsonContent = content;
            if (content.includes("```json")) {
              const match = content.match(/```json\n([\s\S]*?)\n```/);
              if (match) jsonContent = match[1];
            }

            const analysisResults = JSON.parse(jsonContent);

            // Add these results to our signals to process
            for (let i = 0; i < analysisResults.length; i++) {
              const result = analysisResults[i];
              signalsToProcess.push({
                ...result,
                url: urlsToProcess[i],
                date: new Date().toISOString(),
                isUserSubmitted: true,
              });
            }
          } catch (error) {
            console.error("Error parsing AI results:", error);
          }
        }
      } catch (error) {
        console.error("Error calling Groq:", error);
      }
    }

    // Add image URLs as signals
    for (const imageUrl of imageUrls) {
      signalsToProcess.push({
        title: `Image: ${payload.subject}`,
        description: `User submitted image related to ${idea.name}`,
        source: payload.from,
        url: imageUrl,
        date: new Date().toISOString(),
        type: "news",
        isUserSubmitted: true,
      });
    }

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

    // Generate insights from the new signals
    if (savedSignals.length > 0) {
      try {
        // Get existing insights
        const { data: ideaDetails } = await supabase
          .from("ideas")
          .select("insights")
          .eq("id", ideaId)
          .single();

        // Prepare the prompt for generating insights
        const insightsPrompt = `
I need to generate business insights based on new market intelligence that a user has emailed to add to their idea's knowledge base.

BUSINESS IDEA DETAILS:
Idea Name: ${idea.name}
Category: ${idea.category || "Not provided"}
Organization: ${idea.mission?.organization?.name || "Not provided"}
Mission: ${idea.mission?.name || "Not provided"}

EXISTING INSIGHTS:
${
  ideaDetails && ideaDetails.insights
    ? JSON.stringify(ideaDetails.insights)
    : "No existing insights"
}

NEW KNOWLEDGE BASE ITEMS:
${JSON.stringify(
  savedSignals.map((s) => ({
    title: s.title,
    content: s.content,
    source: s.source_name,
    url: s.source_url,
    relevance: s.relevance_score,
  }))
)}

Based on this new information, please generate:
1. 2-3 key insights that this new information provides about the business idea
2. How this impacts the idea's potential or challenges
3. Any recommendations or actions to consider

Format your response as a JSON array of insight objects:
[
  {
    "insight": "One sentence insight statement",
    "impact": "Brief description of how this affects the business idea",
    "source": "Email from user",
    "date_added": "${new Date().toISOString()}"
  }
]
`;

        const completion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: insightsPrompt,
            },
          ],
          model: "mixtral-8x7b-32768",
          temperature: 0.7,
          max_tokens: 2048,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          try {
            // Extract JSON if it's wrapped in markdown
            let jsonContent = content;
            if (content.includes("```json")) {
              const match = content.match(/```json\n([\s\S]*?)\n```/);
              if (match) jsonContent = match[1];
            }

            const newInsights = JSON.parse(jsonContent);

            // Combine with existing insights, ensuring we have valid arrays
            let existingInsights = [];
            if (ideaDetails?.insights) {
              try {
                const parsed = JSON.parse(ideaDetails.insights);
                // Verify that parsed data is an array
                if (Array.isArray(parsed)) {
                  existingInsights = parsed;
                } else {
                  console.error(
                    "Existing insights was not an array, resetting"
                  );
                }
              } catch (e) {
                console.error("Error parsing existing insights:", e);
              }
            }

            // Ensure newInsights is an array
            const validNewInsights = Array.isArray(newInsights)
              ? newInsights
              : [];
            const combinedInsights = [
              ...validNewInsights,
              ...existingInsights,
            ].slice(0, 100); // Limit to last 100 insights

            // Update the idea with new insights
            const { error: updateError } = await supabase
              .from("ideas")
              .update({
                insights: JSON.stringify(combinedInsights),
              })
              .eq("id", ideaId);

            if (updateError) {
              console.error("Error updating insights:", updateError);
            }
          } catch (error) {
            console.error("Error updating insights:", error);
          }
        }
      } catch (error) {
        console.error("Error generating insights:", error);
      }
    }

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

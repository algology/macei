import Groq from "groq-sdk";

// Define TypeScript interfaces for our data structures
interface IdeaItem {
  name: string;
  summary: string;
  source_text: string;
  idea_attributes: string[];
  location: string;
  is_explicit: boolean;
}

interface SuggestedIdeaItem {
  name: string;
  summary: string;
  idea_attributes: string[];
  rationale: string;
  is_ai_suggested: boolean;
}

interface ExtractedIdeas {
  extracted_ideas: IdeaItem[];
}

interface SuggestedIdeas {
  suggested_ideas: SuggestedIdeaItem[];
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organization, mission, mission_description, documentContent } =
      body;

    if (!documentContent || documentContent.trim() === "") {
      return Response.json(
        { error: "Document content is required" },
        { status: 400 }
      );
    }

    // Add document length validation
    const MAX_DOCUMENT_LENGTH = 30000;
    if (documentContent.length > MAX_DOCUMENT_LENGTH) {
      return Response.json(
        {
          error: `Document is too large. Maximum size is ${MAX_DOCUMENT_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    // First, get a summary of the document to help with idea generation
    const summaryPrompt = `
      Summarize the following document content in 300-500 words, focusing on key concepts, insights, and potential innovation areas:
      
      ${documentContent}
    `;

    const summarizationCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: summaryPrompt,
        },
      ],
      model: "gemma2-9b-it",
      temperature: 0.3,
      max_tokens: 1024,
    });

    const documentSummary =
      summarizationCompletion.choices[0]?.message?.content || "";

    // Extract ideas directly mentioned in the document
    const extractIdeasPrompt = `
    You are an expert at identifying explicit business and innovation ideas in documents. Carefully analyze the following document and extract ONLY the clearly formulated ideas that are EXPLICITLY mentioned.

    Document content:
    ${documentContent}

    IMPORTANT DEFINITIONS:
    - An "idea" is a CLEARLY described concept, product, service, feature, or innovation mentioned explicitly in the document.
    - Only include ideas that are EXPLICITLY presented as ideas, proposals, or recommendations.
    - Look for phrases like "our idea is...", "we propose...", "the solution is...", "we recommend...", etc.
    - Do NOT include general concepts, observations, or descriptions that aren't clearly presented as ideas.
    - Do NOT include broad topics, market trends, or general information unless explicitly framed as an idea.

    Instructions:
    1. Extract ONLY clearly defined ideas that are explicitly presented in the document.
    2. Be selective and precise - focus on quality over quantity.
    3. Only include ideas that have clear boundaries and are described as distinct concepts.
    4. For each idea, provide a direct quote from the text that explicitly describes the idea.
    5. If fewer than 10 ideas are explicitly mentioned, that's fine - only include what's clearly there.
    6. If no ideas are explicitly mentioned, return an empty array.

    Return your findings as a valid JSON object with EXACTLY this structure:
    {
      "extracted_ideas": [
        {
          "name": "Short, descriptive name for the idea",
          "summary": "2-3 sentence description of the idea based only on what's in the document",
          "source_text": "The exact text snippet that EXPLICITLY describes this idea (quote directly from document)",
          "idea_attributes": ["Relevant attribute 1", "Relevant attribute 2", "Relevant attribute 3"],
          "location": "Approximate location in document (beginning/middle/end)",
          "is_explicit": true  // This should almost always be true for these focused extractions
        },
        // Additional ideas...
      ]
    }

    CRITICAL REQUIREMENTS:
    - QUALITY OVER QUANTITY - only extract ideas that are clearly and explicitly described
    - Focus on precision - DO NOT include general concepts that aren't explicitly presented as ideas
    - DO NOT extract more than 10 ideas - focus on the most clearly articulated ones
    - Return VALID JSON ONLY - no explanations, no markdown, no text before or after
    - Must include direct source_text with quotes from the document for each idea
    `;

    // Now, generate a few supplementary ideas based on the document and mission context
    const suggestIdeasPrompt = `You are an AI innovation consultant. Based on the following organization, mission, and document content, suggest 2-3 additional ideas that are NOT explicitly mentioned in the document but would complement what's there.

    Organization: ${organization}
    Mission: ${mission}
    Mission Description: ${mission_description || "No description provided"}
    
    Document Summary: ${documentSummary}
    
    Return a valid JSON object with exactly this structure (no markdown, no additional text):
    {
      "suggested_ideas": [
        {
          "name": "Idea name - keep this concise and compelling",
          "summary": "2-3 sentence description of the idea that captures the essence, value proposition, and relevance to the mission",
          "idea_attributes": ["Attribute 1", "Attribute 2", "Attribute 3"],
          "rationale": "Explanation of how this idea builds upon concepts in the document but offers something new",
          "is_ai_suggested": true  // This should always be true for these ideas
        }
      ]
    }
    
    Your suggested ideas should be:
    - Clearly different from what's already in the document
    - Aligned with the mission's goals
    - Technically feasible
    - Market-relevant
    - Distinct from each other
    - In valid JSON format only`;

    // Run both prompts in parallel for efficiency
    const [extractResponse, suggestResponse] = await Promise.all([
      groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are an expert at identifying explicit business and innovation ideas from content. Your primary goal is to extract ONLY clearly articulated ideas that are explicitly presented as ideas in the document. Focus on precision and quality over quantity. Your output must be in valid JSON format only.",
          },
          {
            role: "user",
            content: extractIdeasPrompt,
          },
        ],
        model: "deepseek-r1-distill-qwen-32b", // Use a more powerful model with longer context
        temperature: 0.1, // Lower temperature for factual extraction
        max_tokens: 32000, // Increased token limit to handle more ideas
        top_p: 0.95, // Slightly reduce variability for more focused results
      }),

      groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are an AI innovation consultant who specializes in generating creative business ideas that complement existing concepts. Your suggestions should be unique, implementable, and aligned with the existing context.",
          },
          {
            role: "user",
            content: suggestIdeasPrompt,
          },
        ],
        model: "deepseek-r1-distill-qwen-32b",
        temperature: 0.7,
        max_tokens: 32000,
      }),
    ]);

    // Parse extracted ideas with better error handling
    const extractedContent =
      extractResponse.choices[0]?.message?.content || "{}";
    let extractedIdeas: ExtractedIdeas = { extracted_ideas: [] };

    try {
      // Log the raw content for debugging
      console.log("Raw extracted content length:", extractedContent.length);
      console.log(
        "Raw extracted content preview:",
        extractedContent.substring(0, 500) + "..."
      );

      // First try direct parsing
      try {
        extractedIdeas = JSON.parse(extractedContent) as ExtractedIdeas;
      } catch (e: unknown) {
        console.log(
          "Direct parsing failed, trying alternative approaches:",
          e instanceof Error ? e.message : String(e)
        );

        // If direct parsing fails, try to extract JSON from markdown
        let jsonString = extractedContent;

        // Try to extract JSON from code blocks
        const codeBlockMatch = extractedContent.match(
          /```(?:json)?\n?([\s\S]*?)\n?```/
        );
        if (codeBlockMatch && codeBlockMatch[1]) {
          console.log("Found JSON in code block");
          jsonString = codeBlockMatch[1].trim();
        }
        // Otherwise try to find JSON object pattern
        else {
          const jsonObjectMatch = extractedContent.match(/(\{[\s\S]*\})/);
          if (jsonObjectMatch && jsonObjectMatch[1]) {
            console.log("Found JSON object pattern");
            jsonString = jsonObjectMatch[1].trim();
          }
        }

        // Clean the JSON string (remove any non-JSON text that might be present)
        jsonString = jsonString.replace(/^[^{]*/, "").replace(/[^}]*$/, "");

        // Try to parse the cleaned JSON string
        try {
          extractedIdeas = JSON.parse(jsonString) as ExtractedIdeas;
        } catch (parseError) {
          console.error(
            "Error parsing extracted ideas JSON after cleanup:",
            parseError
          );

          // If we still can't parse, try one more emergency extraction method
          try {
            // Look for the opening of the extracted_ideas array
            const arrayStartMatch = jsonString.match(
              /"extracted_ideas"\s*:\s*\[/
            );
            if (arrayStartMatch) {
              // Construct a minimal valid JSON wrapper
              const minimalJson =
                `{"extracted_ideas":[` +
                // Take everything between the array start and the last valid element
                jsonString.substring(
                  jsonString.indexOf("[") + 1,
                  jsonString.lastIndexOf("]")
                ) +
                `]}`;

              console.log(
                "Emergency JSON repair attempt, preview:",
                minimalJson.substring(0, 100) + "..."
              );
              extractedIdeas = JSON.parse(minimalJson) as ExtractedIdeas;
            }
          } catch (emergencyError) {
            console.error("Emergency JSON repair failed:", emergencyError);

            // As a last resort, extract ideas manually from the raw text
            console.log("Attempting manual idea extraction from raw text");
            const manualIdeas = [];

            // Look for patterns that might indicate an idea
            const ideaMatches =
              extractedContent.match(/["']name["']\s*:\s*["']([^"']+)["']/g) ||
              [];

            for (let i = 0; i < ideaMatches.length; i++) {
              // Extract name from the match
              const nameMatch = ideaMatches[i].match(
                /["']name["']\s*:\s*["']([^"']+)["']/
              );
              if (nameMatch && nameMatch[1]) {
                const name = nameMatch[1];

                // Try to find context around this name to build a minimal idea object
                manualIdeas.push({
                  name: name,
                  summary: "Recovered from parsing error",
                  source_text: "Source could not be recovered",
                  idea_attributes: ["Manual recovery"],
                  location: "Unknown",
                  is_explicit: true,
                });
              }
            }

            if (manualIdeas.length > 0) {
              console.log(`Manually recovered ${manualIdeas.length} ideas`);
              extractedIdeas = { extracted_ideas: manualIdeas };
            } else {
              extractedIdeas = { extracted_ideas: [] };
            }
          }
        }
      }
    } catch (outerError) {
      console.error("Unexpected error handling extracted ideas:", outerError);
      extractedIdeas = { extracted_ideas: [] };
    }

    // Parse suggested ideas with better error handling
    const suggestedContent =
      suggestResponse.choices[0]?.message?.content || "{}";
    let suggestedIdeas: SuggestedIdeas = { suggested_ideas: [] };

    try {
      // First try direct parsing
      try {
        suggestedIdeas = JSON.parse(suggestedContent) as SuggestedIdeas;
      } catch (e: unknown) {
        // If direct parsing fails, try to extract JSON from markdown
        let jsonString = suggestedContent;

        // Try to extract JSON from code blocks
        const codeBlockMatch = suggestedContent.match(
          /```(?:json)?\n?([\s\S]*?)\n?```/
        );
        if (codeBlockMatch && codeBlockMatch[1]) {
          jsonString = codeBlockMatch[1].trim();
        }
        // Otherwise try to find JSON object pattern
        else {
          const jsonObjectMatch = suggestedContent.match(/(\{[\s\S]*\})/);
          if (jsonObjectMatch && jsonObjectMatch[1]) {
            jsonString = jsonObjectMatch[1].trim();
          }
        }

        // Clean the JSON string
        jsonString = jsonString.replace(/^[^{]*/, "").replace(/[^}]*$/, "");

        // Try to parse the cleaned JSON string
        try {
          suggestedIdeas = JSON.parse(jsonString) as SuggestedIdeas;
        } catch (parseError) {
          console.error(
            "Error parsing suggested ideas JSON after cleanup:",
            parseError
          );
          // Fall back to empty result
          suggestedIdeas = { suggested_ideas: [] };
        }
      }
    } catch (outerError) {
      console.error("Unexpected error handling suggested ideas:", outerError);
      suggestedIdeas = { suggested_ideas: [] };
    }

    // Debug the extracted results
    console.log("Extracted ideas raw content type:", typeof extractedContent);
    console.log(
      "Extracted ideas data structure:",
      JSON.stringify(extractedIdeas, null, 2)
    );
    console.log(
      "Suggested ideas data structure:",
      JSON.stringify(suggestedIdeas, null, 2)
    );

    // Combine both results, with additional validation
    const combinedResults = {
      extracted_ideas: Array.isArray(extractedIdeas.extracted_ideas)
        ? extractedIdeas.extracted_ideas
        : [],
      suggested_ideas: Array.isArray(suggestedIdeas.suggested_ideas)
        ? suggestedIdeas.suggested_ideas
        : [],
    };

    // Log the final output
    console.log(
      `Final output has ${combinedResults.extracted_ideas.length} extracted ideas and ${combinedResults.suggested_ideas.length} suggested ideas`
    );

    return Response.json({
      content: combinedResults,
      documentSummary,
    });
  } catch (error) {
    console.error("Error generating ideas from document:", error);
    return Response.json(
      { error: "Failed to generate ideas from document" },
      { status: 500 }
    );
  }
}

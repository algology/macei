import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper function to generate attributes with the LLM
async function generateAttributesWithLLM(
  prompt: string,
  retryCount = 0
): Promise<{
  content: any;
  thinking: string;
}> {
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a business analyst specializing in identifying highly specific and unique success factors for innovative ideas. First share your thinking process within <think> tags, then provide your final answer as a clean JSON object without any markdown formatting or code blocks. Always be extremely specific and avoid generic business terms.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "deepseek-r1-distill-qwen-32b",
      temperature: 0.5,
      max_tokens: 2048,
      stream: false,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from Groq API");
    }

    // Extract thinking process and JSON response
    const thinkMatch = response.match(/<think>([\s\S]*?)<\/think>/);
    const thinking = thinkMatch ? thinkMatch[1].trim() : "";

    // Extract JSON after the thinking process
    let jsonPart = response.replace(/<think>[\s\S]*?<\/think>/, "").trim();

    // Remove any markdown code blocks
    jsonPart = jsonPart.replace(/```json\n?|\n?```/g, "").trim();

    try {
      const parsedAttributes = JSON.parse(jsonPart);

      // Validate the response format
      if (
        !parsedAttributes.attributes ||
        !Array.isArray(parsedAttributes.attributes)
      ) {
        throw new Error("Invalid response format from LLM");
      }

      // Ensure all attributes are strings
      const validAttributes = parsedAttributes.attributes.every(
        (attr: any) => typeof attr === "string"
      );
      if (!validAttributes) {
        throw new Error("Invalid attribute format");
      }

      return {
        content: parsedAttributes,
        thinking: thinking,
      };
    } catch (parseError: any) {
      console.error(
        "Error parsing LLM response:",
        parseError,
        "Raw response:",
        response
      );

      // If we've already retried the maximum number of times, rethrow the error
      const MAX_RETRIES = 3;
      if (retryCount >= MAX_RETRIES) {
        throw new Error(
          `Failed to parse attributes after ${MAX_RETRIES} attempts: ${parseError.message}`
        );
      }

      // Otherwise, retry with an improved prompt
      console.log(`Retry attempt ${retryCount + 1} of ${MAX_RETRIES}...`);

      // Update the prompt to be more explicit about JSON format
      const updatedPrompt =
        prompt +
        `\n\nIMPORTANT: Your response MUST be valid JSON conforming to this exact format without any markdown or text before or after:
{
  "attributes": [
    "Idea Attribute 1",
    "Idea Attribute 2",
    "Idea Attribute 3"
  ]
}`;

      // Recursive call with the updated prompt and incremented retry count
      return generateAttributesWithLLM(updatedPrompt, retryCount + 1);
    }
  } catch (error) {
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, summary, mission, organization } = body;

    if (!name || !summary) {
      return Response.json(
        { error: "Name and summary are required" },
        { status: 400 }
      );
    }

    const prompt = `You are an AI business analyst tasked with identifying key idea attributes to monitor for a business idea.

Context:
Organization: ${organization}
Mission: ${mission}
Idea Name: ${name}
Idea Summary: ${summary}

Instructions:
1. First, think through what market developments would most impact this idea's success or failure. Prefix your thinking with <think> and end with </think>.

2. Then, identify 3-5 key idea attributes that should be monitored. Each idea attribute MUST be:
   - Specific enough to be meaningful for this idea
   - Broad enough to regularly find news and developments about
   - Focused on external market developments rather than internal metrics
   - Likely to appear in news articles, research papers, or patents
   - A mix of technology trends, market movements, and industry developments

Examples of BAD idea attributes:
- "Internal Process Efficiency" (not externally monitorable)
- "Customer Satisfaction" (too internal)
- "Market Size" (too vague)
- "Revenue Growth" (not a market signal)

Examples of GOOD idea attributes:
- "AI Chip Manufacturing Advances"
- "Renewable Energy Storage Innovations"
- "Supply Chain Digitalization Trends"
- "Healthcare Data Privacy Regulations"
- "Space Launch Cost Developments"

After your thinking process, provide your final idea attributes in this exact JSON format without any markdown formatting or code blocks:
{
  "attributes": [
    "Idea Attribute 1",
    "Idea Attribute 2",
    "Idea Attribute 3"
  ]
}`;

    try {
      const result = await generateAttributesWithLLM(prompt);
      return Response.json({
        content: result.content,
        thinking: result.thinking,
      });
    } catch (error) {
      console.error("Error generating attributes:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate attributes",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process request",
      },
      { status: 500 }
    );
  }
}

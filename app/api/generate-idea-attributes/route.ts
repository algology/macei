import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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

    const prompt = `You are an AI business analyst tasked with identifying highly specific and unique attributes for a business idea.

Context:
Organization: ${organization}
Mission: ${mission}
Idea Name: ${name}
Idea Summary: ${summary}

Instructions:
1. First, think through the analysis process, considering what makes this specific idea unique and different from similar ideas. Prefix your thinking with <think> and end with </think>.

2. Then, identify 3-5 key attributes that will determine this idea's success or failure. Each attribute MUST be:
   - HIGHLY SPECIFIC to this exact idea (not generic terms like "market size" or "competition")
   - Unique to this industry and use case
   - Measurable and actionable
   - Focused on critical success factors for THIS specific idea
   - Detailed enough that they wouldn't apply to most other ideas

Examples of BAD (too generic) attributes:
- "Market Size" (too generic)
- "Customer Demand" (applies to any business)
- "Technical Feasibility" (too vague)
- "Cost Structure" (too general)

Examples of GOOD (specific) attributes:
- "Rural Solar Grid Integration Capacity"
- "Last-Mile Fiber Optic Coverage"
- "Enterprise Client Migration Speed"
- "AI Model Training Cost per Hour"
- "Cross-Border Data Transfer Latency"

After your thinking process, provide your final attributes in this exact JSON format without any markdown formatting or code blocks:
{
  "attributes": [
    "Attribute 1",
    "Attribute 2",
    "Attribute 3"
  ]
}`;

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

      return Response.json({
        content: parsedAttributes,
        thinking: thinking,
      });
    } catch (parseError) {
      console.error(
        "Error parsing LLM response:",
        parseError,
        "Raw response:",
        response
      );
      return Response.json(
        { error: "Failed to parse attributes from LLM response" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error generating idea attributes:", error);
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
}

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      name,
      category,
      signals,
      status,
      impact,
      organization,
      mission,
      mission_description,
    } = body;

    const prompt = `You are an AI business analyst. Provide a concise validation of this business idea:

Organization: ${organization}
Mission: ${mission}
Mission Description: ${mission_description || "No description provided"}

Idea Name: ${name}
Category: ${category}
Current Status: ${status}
Expected Impact: ${impact}

Market Signals:
${signals}

Please provide a brief analysis in markdown format with the following sections:

# Quick Analysis: ${name}

## Mission Fit
[Brief assessment of alignment with organization's mission]

## Market Validation
[Key market insights and potential]

## Next Steps
[1-2 key recommendations]

Remember to:
- Be concise and direct
- Highlight critical points in **bold**
- Consider both mission alignment and market signals`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "gemma2-9b-it",
      temperature: 0.7,
      max_tokens: 1024,
    });

    return Response.json({
      content: completion.choices[0]?.message?.content || "",
    });
  } catch (error) {
    console.error("Error in AI analysis:", error);
    return Response.json({ error: "Failed to analyze idea" }, { status: 500 });
  }
}

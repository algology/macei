import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { organization, mission, mission_description } = body;

    const prompt = `You are an AI innovation consultant. Based on the following organization and mission, generate 3 potential ideas that would be worth exploring. Each idea should be realistic and aligned with the mission's goals.

Organization: ${organization}
Mission: ${mission}
Mission Description: ${mission_description || "No description provided"}

Return a valid JSON object with exactly this structure (no markdown, no additional text):
{
  "ideas": [
    {
      "name": "Idea name",
      "category": "Relevant category",
      "description": "2-3 sentence description of the idea",
      "signals": "Comma-separated list of relevant market signals to track"
    }
  ]
}

Ensure:
- Mission alignment
- Technical feasibility
- Market potential
- Current industry trends
- Exactly 3 ideas
- Valid JSON format only`;

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

    // Ensure we're returning clean JSON
    const content = completion.choices[0]?.message?.content || "{}";
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (e) {
      // If direct parsing fails, try to extract JSON from markdown
      const jsonMatch =
        content.match(/```json\n?([\s\S]*?)\n?```/) ||
        content.match(/\{[\s\S]*\}/);
      parsedContent = jsonMatch
        ? JSON.parse(jsonMatch[1] || jsonMatch[0])
        : { ideas: [] };
    }

    return Response.json({
      content: JSON.stringify(parsedContent),
    });
  } catch (error) {
    console.error("Error generating ideas:", error);
    return Response.json(
      { error: "Failed to generate ideas" },
      { status: 500 }
    );
  }
}

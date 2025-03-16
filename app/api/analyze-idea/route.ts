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
      organization,
      mission,
      mission_description,
    } = body;

    const prompt = `You are an AI business analyst. Analyze this business idea and provide structured feedback in the following format:

Organization: ${organization}
Mission: ${mission}
Mission Description: ${mission_description || "No description provided"}

Idea Name: ${name}
Category: ${category}
Current Status: ${status}

Market Signals:
${signals}

Knowledge Base Documents:
${body.documents}

Please provide your analysis in the following JSON structure, taking into account both the market signals and the knowledge base documents:

{
  "missionAlignment": {
    "score": <number between 0-100>,
    "analysis": "<one paragraph explanation>"
  },
  "feasibility": {
    "score": <number between 0-100>,
    "analysis": "<one paragraph explanation>"
  }
}

Consider:
- Mission alignment: How well does this align with organizational goals
- Feasibility: Technical, legal, and practical implementation challenges
- Knowledge base documents: Use the provided documents to support or challenge the idea's viability`;

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

import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, ideaDetails, documents } = body;

    const prompt = `You are an AI assistant with access to knowledge about the following business idea and its associated documents. Use this context to answer questions and provide insights.

Organization: ${ideaDetails.mission?.organization?.name || "Not specified"}
Mission: ${ideaDetails.mission?.name || "Not specified"}
Mission Description: ${ideaDetails.mission?.description || "Not specified"}

Idea Name: ${ideaDetails.name}
Category: ${ideaDetails.category}
Current Status: ${ideaDetails.status}
Expected Impact: ${ideaDetails.impact}

Market Signals:
${ideaDetails.signals}

Knowledge Base Documents:
${documents}

User Question: ${message}

Please provide a helpful, accurate response based on the available information. If you're unsure or if the information isn't available in the provided context, please say so.`;

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
    console.error("Error in knowledge base chat:", error);
    return Response.json({ error: "Failed to process chat" }, { status: 500 });
  }
}

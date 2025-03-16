import { supabase } from "@/lib/supabase";
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

    const prompt = `You are an AI business analyst. Based on the following information, provide a deep analysis of this business idea:

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

Please identify the 3-5 most critical attributes specific to this idea and provide a detailed analysis in the following JSON structure:

{
  "attributes": [
    {
      "name": "Attribute Name",
      "importance": <number between 0-100>,
      "current_assessment": "Current state or evaluation of this attribute",
      "risks": "Key risks related to this attribute",
      "opportunities": "Potential opportunities related to this attribute",
      "evidence": "Evidence from market signals or documents supporting this analysis"
    }
  ],
  "summary": "A concise summary of why these attributes are the most critical for this specific idea"
}

Focus on attributes that are:
1. Unique to this specific idea and industry
2. Material to the success or failure
3. Backed by evidence from the provided documents or market signals
4. Actionable and specific`;

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "deepseek-r1-distill-qwen-32b",
      temperature: 0.7,
      max_tokens: 2048,
    });

    let analysisJson = completion.choices[0]?.message?.content || "";
    if (analysisJson.includes("```json")) {
      const jsonMatch = analysisJson.match(/```json\n([\s\S]*?)\n```/);
      analysisJson = jsonMatch ? jsonMatch[1] : analysisJson;
    }

    const parsedAnalysis = JSON.parse(analysisJson);

    // Update the idea in the database with the detailed analysis
    const { error: updateError } = await supabase
      .from("ideas")
      .update({
        detailed_analysis: JSON.stringify(parsedAnalysis),
      })
      .eq("id", body.id);

    if (updateError) throw updateError;

    return Response.json({ content: parsedAnalysis });
  } catch (error) {
    console.error("Error in deep analysis:", error);
    return Response.json({ error: "Failed to analyze idea" }, { status: 500 });
  }
}

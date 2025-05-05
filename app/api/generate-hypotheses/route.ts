// app/api/generate-hypotheses/route.ts
// import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'; // REMOVED
import { createClient } from '@supabase/supabase-js'; // Standard Node.js client
import Groq from 'groq-sdk';
// import { cookies } from 'next/headers'; // REMOVED

// REMOVED type imports and definitions as we rely on inference

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Ensure these environment variables are set!
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Define allowed priority values (lowercase for ENUM matching)
const ALLOWED_PRIORITIES = ['high', 'medium', 'low'];

// Define expected structure from LLM
interface HypothesisSuggestion {
    statement: string;
    priority?: string | null; // Expect string now
}

export async function POST(request: Request) {
  // Create a Supabase client with the service role key to bypass RLS
  if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase URL or Service Role Key environment variables.");
      return Response.json({ error: 'Server configuration error.' }, { status: 500 });
  }
  // Note: No need for database types generic here if we are relying on inference
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { ideaId } = body;

    if (!ideaId || typeof ideaId !== 'number') {
      return Response.json({ error: 'Valid ideaId is required' }, { status: 400 });
    }

    // 1. Fetch idea details for context (using service role client)
    const { data: ideaData, error: ideaError } = await supabase
      .from('ideas')
      .select(`
        *,
        mission:missions (
          *,
          organization:organizations (*)
        )
      `)
      .eq('id', ideaId)
      .single(); // .single() should now work as service role bypasses RLS

    // Explicit check for error or null ideaData
    if (ideaError) {
       // Log the specific error from Supabase
      console.error(`Database error fetching idea ${ideaId} (service role):`, ideaError);
      // Return a more specific error message if possible
      return Response.json({ error: `Failed to fetch idea details: ${ideaError.message}` }, { status: 500 });
    }
    if (!ideaData) {
        console.error(`Idea with ID ${ideaId} not found (service role).`);
        return Response.json({ error: 'Idea not found' }, { status: 404 });
    }

    // --- Relying on inferred type for ideaData ---
    if (!ideaData.name) {
        console.error(`Fetched idea ${ideaId} is missing a name.`);
        return Response.json({ error: 'Idea data is incomplete (missing name)' }, { status: 500 });
    }

    // 2. Construct Prompt for LLM
    const prompt = `You are an AI assistant specializing in business validation. Based on the following idea, generate 5-7 distinct, specific, and testable hypotheses. These hypotheses should represent the core assumptions that need to be true for this idea to succeed. Focus on aspects like target market, value proposition, feasibility, and potential risks.

For each hypothesis, assign a priority level: "High", "Medium", or "Low", based on its perceived importance to the idea's success.

Idea Name: ${ideaData.name}
Idea Description: ${ideaData.description || 'No description provided.'}
Idea Summary: ${ideaData.summary || 'No summary provided.'}
Category: ${ideaData.category || 'N/A'}
Mission: ${ideaData.mission?.name || 'N/A'}
Organization: ${ideaData.mission?.organization?.name || 'N/A'}

Return ONLY a valid JSON object with the following structure, no markdown, no introductory text:
{
  "hypotheses": [
    {
      "statement": "Hypothesis statement 1",
      "priority": "High" | "Medium" | "Low"
    },
    {
      "statement": "Hypothesis statement 2",
      "priority": "High" | "Medium" | "Low"
    },
    ...
  ]
}

Ensure each hypothesis is a clear statement that can potentially be tested or researched. Ensure the priority is exactly one of "High", "Medium", or "Low".`;

    // 3. Call LLM (Groq in this case)
    console.log(`Generating hypotheses with string priorities for idea ${ideaId}: ${ideaData.name}`);
    const completion = await groq.chat.completions.create({
        messages: [ { role: 'user', content: prompt } ],
        model: 'deepseek-r1-distill-llama-70b',
        temperature: 0.6,
        max_tokens: 1500,
        response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    let parsedContent;
    try {
       parsedContent = JSON.parse(content);
       // Validate the new structure
       if (!parsedContent.hypotheses || !Array.isArray(parsedContent.hypotheses) || 
           !parsedContent.hypotheses.every((h: any) => typeof h.statement === 'string' && (typeof h.priority === 'string' || h.priority === null || h.priority === undefined))) {
           console.warn('LLM response structure mismatch for hypotheses with string priority:', parsedContent);
           throw new Error("Invalid JSON structure received for hypotheses with string priority.");
       }
    } catch (e) {
      console.error("Error parsing LLM response for hypotheses with string priority:", e, "Content:", content);
      // Add fallback logic if needed, potentially generating without priority
      parsedContent = { hypotheses: [] };
    }

    // Use the validated structure, default priority if missing
    const hypothesisSuggestions: HypothesisSuggestion[] = parsedContent.hypotheses || [];

    if (hypothesisSuggestions.length === 0) {
        console.warn(`No hypotheses generated by LLM for idea ${ideaId}.`);
        return Response.json({ message: 'Idea created, but no hypotheses were generated.', count: 0 });
    }

    // 4. Insert Hypotheses into DB (using service role client)
    const hypothesesToInsert = hypothesisSuggestions.map(suggestion => {
        const rawPriority = suggestion.priority?.trim().toLowerCase();
        const validatedPriority = rawPriority && ALLOWED_PRIORITIES.includes(rawPriority) ? rawPriority : null;
        return {
            idea_id: ideaId,
            statement: suggestion.statement.trim(),
            status: 'untested',
            priority: validatedPriority,
        };
    });

    const { error: insertError } = await supabase
      .from('hypotheses')
      .insert(hypothesesToInsert);

    if (insertError) {
      console.error(`Error inserting hypotheses for idea ${ideaId} (service role):`, insertError);
      return Response.json({ message: 'Idea created, but failed to save generated hypotheses.', error: insertError.message, count: 0 }, { status: 500 });
    }

    console.log(`Successfully generated and saved ${hypothesesToInsert.length} hypotheses with priorities for idea ${ideaId}.`);
    return Response.json({ message: 'Hypotheses generated successfully.', count: hypothesesToInsert.length });

  } catch (error) {
    console.error('Unexpected error in /api/generate-hypotheses:', error);
    return Response.json({ error: 'Internal server error during hypothesis generation.' }, { status: 500 });
  }
}
 
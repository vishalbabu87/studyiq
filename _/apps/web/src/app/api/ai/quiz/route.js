export async function POST(request) {
  try {
    const { message } = await request.json();
    const systemPrompt = `You are a quiz assistant. Parse this request and extract quiz parameters. Respond with JSON: { "reply": "confirmation message", "quizConfig": { "questionCount": number, "difficulty": "easy/medium/hard", "mode": "sequential/random" } }. If you can't parse it, just reply with a helpful message and no quizConfig.`;

    let aiResponse = null;

    // Try Gemini 2.5 Pro first
    try {
      const geminiResponse = await fetch(
        "/integrations/google-gemini-2-5-pro/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        },
      );

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          try {
            aiResponse = JSON.parse(text);
          } catch {
            aiResponse = { reply: text, quizConfig: null };
          }
        }
      }
    } catch (error) {
      console.error("Gemini error:", error);
    }

    // Try GROQ as fallback
    if (!aiResponse) {
      try {
        const groqResponse = await fetch("/integrations/groq/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message },
            ],
          }),
        });

        if (groqResponse.ok) {
          const data = await groqResponse.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            try {
              aiResponse = JSON.parse(text);
            } catch {
              aiResponse = { reply: text, quizConfig: null };
            }
          }
        }
      } catch (error) {
        console.error("GROQ error:", error);
      }
    }

    // Try ChatGPT as second fallback
    if (!aiResponse) {
      try {
        const chatgptResponse = await fetch(
          "/integrations/chat-gpt/conversationgpt4",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
              ],
            }),
          },
        );

        if (chatgptResponse.ok) {
          const data = await chatgptResponse.json();
          const text = data.choices?.[0]?.message?.content || data.result;
          if (text) {
            try {
              aiResponse = JSON.parse(text);
            } catch {
              aiResponse = { reply: text, quizConfig: null };
            }
          }
        }
      } catch (error) {
        console.error("ChatGPT error:", error);
      }
    }

    // Local parsing fallback
    if (!aiResponse) {
      const questionMatch = message.match(/(\d+)\s*(questions?|q)/i);
      const difficultyMatch = message.match(/(easy|medium|hard)/i);
      const modeMatch = message.match(/(random|sequential|sequence|order)/i);

      if (questionMatch) {
        aiResponse = {
          reply: `I'll create a quiz with ${questionMatch[1]} questions. Please select your category and file to continue.`,
          quizConfig: {
            questionCount: parseInt(questionMatch[1]),
            difficulty: difficultyMatch
              ? difficultyMatch[1].toLowerCase()
              : "medium",
            mode:
              modeMatch && modeMatch[1].toLowerCase().includes("random")
                ? "random"
                : "sequential",
          },
        };
      } else {
        aiResponse = {
          reply:
            "I can help you create a quiz! Try saying: 'Create 20 medium difficulty questions' or 'Generate a hard quiz with 50 random questions'",
          quizConfig: null,
        };
      }
    }

    return Response.json(aiResponse);
  } catch (error) {
    console.error("AI quiz error:", error);
    return Response.json({
      reply: "Sorry, I encountered an error. Please try the manual quiz setup.",
      quizConfig: null,
    });
  }
}

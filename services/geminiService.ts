
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, MoodLabel } from "../types";
import { EXERCISES } from "../constants";

function simpleFallbackAnalysis(text: string): AnalysisResult {
  const t = text.trim();
  const length = t.length;
  const ex = (t.match(/!/g) || []).length;
  const q = (t.match(/\?/g) || []).length;
  const ellipsis = t.includes("...");
  const uppercaseLetters = (t.match(/[A-Z]/g) || []).length;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  const upperRatio = letters ? uppercaseLetters / letters : 0;

  let moodScore = 0;
  let moodLabel: MoodLabel = "Neutral";

  const lower = t.toLowerCase();
  const short = length <= 20;

  if (!t) {
    moodScore = 0;
    moodLabel = "Neutral";
  } else if (short && /happy|yay|awesome|good/i.test(t)) {
    moodScore = 0.6;
    moodLabel = "Happy";
  } else if (short && /sad|down|depress|cry/i.test(t)) {
    moodScore = -0.5;
    moodLabel = "Sad";
  } else if (short && /angry|mad|furious|hate|fuck|shit/i.test(t)) {
    moodScore = -0.6;
    moodLabel = "Angry";
  } else if (ex > 2 && upperRatio > 0.3) {
    moodScore = -0.6;
    moodLabel = "Angry";
  } else if (q > 2 || ellipsis) {
    moodScore = -0.4;
    moodLabel = "Anxious";
  } else if (length > 200 && ex === 0 && q === 0) {
    moodScore = -0.3;
    moodLabel = "Sad";
  } else if (ex > 0 && q === 0 && upperRatio < 0.2) {
    moodScore = 0.5;
    moodLabel = "Happy";
  } else if (length > 80) {
    moodScore = -0.1;
    moodLabel = "Sad";
  } else {
    moodScore = 0;
    moodLabel = "Neutral";
  }

  let suggestedExerciseId = "stretch-reset";
  if (moodLabel === "Angry" || moodLabel === "Anxious" || moodLabel === "Sad") {
    suggestedExerciseId = "breath-4-6";
  } else if (moodLabel === "Happy") {
    suggestedExerciseId = "kindness-check";
  }

  const aiAdvice =
    moodLabel === "Happy"
      ? "This feels like a lighter moment. Enjoy it and breathe it in."
      : moodLabel === "Neutral"
        ? "Even neutral days matter. Notice one small thing that feels okay."
        : "This sounds like a lot. Try to slow down and take one gentle breath.";

  return {
    moodLabel,
    moodScore,
    keywords: [],
    crisisFlag: false,
    aiAdvice,
    suggestedExerciseId
  };
}

export async function analyzeJournalEntry(text: string): Promise<AnalysisResult> {
  try {
    // Initialize GoogleGenAI instance right before the API call to ensure it uses the latest API key.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the sentiment of this teen's journal entry: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            moodLabel: {
              type: Type.STRING,
              description: "One word mood: Happy, Neutral, Sad, Anxious, Angry, Grateful, or Tired.",
            },
            moodScore: {
              type: Type.NUMBER,
              description: "A sentiment score from -1 (extremely negative/crisis) to 1 (extremely positive).",
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Main emotional keywords extracted from the text.",
            },
            crisisFlag: {
              type: Type.BOOLEAN,
              description: "True if there are mentions of self-harm or immediate danger.",
            },
            aiAdvice: {
              type: Type.STRING,
              description: "A short, supportive, non-judgmental response for a teenager (max 2 sentences).",
            },
            suggestedExerciseId: {
              type: Type.STRING,
              description: "The ID of the most appropriate wellness exercise.",
            }
          },
          required: ["moodLabel", "moodScore", "keywords", "crisisFlag", "aiAdvice", "suggestedExerciseId"],
        },
      },
    });

    // Access .text property directly (not as a method).
    const result = JSON.parse(response.text.trim()) as AnalysisResult;
    
    // Validate exercise ID or provide fallback
    const validIds = EXERCISES.map(e => e.id);
    if (!validIds.includes(result.suggestedExerciseId)) {
        result.suggestedExerciseId = result.moodScore < 0 ? "breath-4-6" : "stretch-reset";
    }

    return result;
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return simpleFallbackAnalysis(text);
  }
}

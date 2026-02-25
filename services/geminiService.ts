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

  // ...rest unchanged (exerciseId + aiAdvice)...
}export async function analyzeJournalEntry(text: string): Promise<AnalysisResult> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // ...
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return simpleFallbackAnalysis(text);
  }
}

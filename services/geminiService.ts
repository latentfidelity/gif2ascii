import { GoogleGenAI, Type } from "@google/genai";
import { GeminiAnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeImageStyle = async (base64Image: string): Promise<GeminiAnalysisResult> => {
  try {
    const modelId = "gemini-2.5-flash-image";
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image
            }
          },
          {
            text: "Analyze this image. I am converting it to ASCII art. Suggest a specific set of ASCII characters (ordered from darkest/densest to lightest) that capture the texture and mood of this image. For example, use blocky chars for buildings, organic curves for nature, etc. Also suggest a 'mood' color hex code and a short witty caption."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: { type: Type.STRING, description: "A short, witty 1-sentence caption describing the GIF's vibe." },
            moodColor: { type: Type.STRING, description: "A hex color code (e.g., #FF0055) representing the dominant mood." },
            recommendedChars: { type: Type.STRING, description: "A string of 10-15 ASCII characters ordered from highest visual density (darkest) to lowest (lightest)." },
            theme: { type: Type.STRING, description: "A one word theme name (e.g. Cyberpunk, Nature, Retro)." }
          },
          required: ["caption", "moodColor", "recommendedChars", "theme"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiAnalysisResult;
    }
    
    throw new Error("No response text from Gemini");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // Fallback
    return {
      caption: "Analysis failed, using default settings.",
      moodColor: "#ffffff",
      recommendedChars: "@%#*+=-:. ",
      theme: "Default"
    };
  }
};

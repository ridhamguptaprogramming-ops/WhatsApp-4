import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const geminiService = {
  async summarizeChat(messages: { text: string; senderName: string }[]): Promise<string> {
    if (!process.env.GEMINI_API_KEY) {
      return "AI Summarization is currently unavailable (API Key missing).";
    }

    try {
      const chatContext = messages
        .map(m => `${m.senderName}: ${m.text}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a helpful chat assistant. Summarize the following chat conversation into a concise paragraph. Highlight the main topics and any action items.
        
        Conversation:
        ${chatContext}`,
        config: {
          systemInstruction: "Be concise and professional. Use bullet points for action items if any.",
        },
      });

      return response.text || "Could not generate summary.";
    } catch (error) {
      console.error("Gemini summarization error:", error);
      return "Error generating summary.";
    }
  },

  async suggestSmartReplies(lastMessage: string, context?: string): Promise<string[]> {
    if (!process.env.GEMINI_API_KEY) return [];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Given the last message in a chat, suggest 3 short, helpful smart replies.
        
        Last Message: ${lastMessage}
        ${context ? `Context: ${context}` : ''}
        
        Return ONLY a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
      });

      const text = response.text?.trim() || "[]";
      return JSON.parse(text);
    } catch (error) {
      console.error("Gemini smart reply error:", error);
      return [];
    }
  },

  async generateTaskDetails(messageText: string): Promise<{ title: string; category: string }> {
    if (!process.env.GEMINI_API_KEY) return { title: messageText, category: 'General' };

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract a clear task title and a category from this chat message.
        
        Message: ${messageText}
        
        Return ONLY a JSON object with "title" and "category" fields.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING }
            }
          }
        },
      });

      return JSON.parse(response.text?.trim() || '{"title": "'+messageText+'", "category": "General"}');
    } catch (error) {
      return { title: messageText, category: 'General' };
    }
  }
};

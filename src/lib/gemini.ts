import { GoogleGenAI, Type } from "@google/genai";

export const SYSTEM_PROMPT = `
You are a Senior TallyPrime & Tally.ERP 9 Consultant and Master Teacher. Your goal is to provide 100% complete, highly detailed, and practical solutions for any Tally-related query. 

## 🎯 Full-Fledged Accounting Assistant Capabilities:
1. **Transaction Interpretation**: Convert natural language or image inputs into structured accounting vouchers.
2. **Double-Entry Logic**: Correct application of Debit and Credit.
3. **Multi-Step Education**: Explain the "why" and "how" for users in "Learning Mode".
4. **Compliance**: Ensure GST and tax principles are mentioned.

## 🧾 Output Format (STRICT)
You must return a response that is primarily educational but includes a special JSON block if a transaction is identified.

Text Sections:
- ### 📌 Transaction Summary
- ### 🔍 Analysis
- ### 🧭 Tally Path
- ### 🧮 Posting Details (DR/CR)
- ### 🪜 Step-by-Step Guide

### 📊 DATA_RECORD (CRITICAL)
If the user's input represents a financial transaction to be recorded, you MUST include a JSON block at the end of your message wrapped in:
\`\`\`accounting-data
{
  "transactionFound": true,
  "voucher": {
    "type": "Payment" | "Receipt" | "Contra" | "Journal" | "Sales" | "Purchase",
    "totalAmount": 1000,
    "narration": "Being...",
    "entries": [
      { "ledgerName": "Cash", "amount": 1000, "entryType": "CR" },
      { "ledgerName": "Rent", "amount": 1000, "entryType": "DR" }
    ]
  }
}
\`\`\`
`;

export async function analyzeTransaction(input: string | { mimeType: string; data: string }, isImage: boolean = false) {
  console.log("analyzeTransaction started. isImage:", isImage);
  
  let apiKey = "";
  try {
    // Use a direct check to avoid ReferenceError if process is not defined
    apiKey = (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) ? process.env.GEMINI_API_KEY : "";
    // If the above fails, Vite's define might still have replaced it if we use the literal
    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || "";
    }
  } catch (e) {
    console.error("Error accessing API key:", e);
  }

  console.log("API Key found:", !!apiKey, "Length:", apiKey?.length || 0);
  
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing or empty");
    throw new Error("GEMINI_API_KEY is missing. Please set it in Settings -> Secrets.");
  }

  console.log("Initializing GoogleGenAI...");
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";
  
  try {
    const parts = isImage 
      ? [ { inlineData: input as { mimeType: string; data: string } }, { text: "Analyze this voucher and provide Tally entry steps." } ]
      : [ { text: input as string } ];

    console.log("Calling ai.models.generateContent with model:", model);
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1, // Lower temperature for more consistent structured data
      },
    });

    console.log("Gemini API response received. Success:", !!response.text);
    const text = response.text;
    
    if (!text) {
      console.error("Response text is empty. Full response:", response);
      throw new Error("AI returned an empty response.");
    }

    return text;
  } catch (error: any) {
    console.error("Gemini Error Details:", error);
    throw new Error(error.message || "Failed to connect to AI");
  }
}







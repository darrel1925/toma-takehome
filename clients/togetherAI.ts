import Together from "together-ai";
import OpenAI from "openai";
import { Message } from "../service/voiceAgent.ts";

class TogetherAI {
  private together: Together;
  private openai: OpenAI;

  constructor() {
    this.together = new Together({
      apiKey: process.env["TOGETHER_AI_API_KEY"],
    });

    this.openai = new OpenAI({
      organization: process.env["OPENAI_API_ORG"],
      project: process.env["OPENAI_API_PROJECT"],
    });
  }

  // Get LLM response from OpenAI
  public async getResponse(messages: Message[]): Promise<Message[]> {
    const resp = await this.openai.chat.completions.create({
      messages: messages,
      model: "gpt-4o",
    });

    if (!resp.choices || !resp.choices[0].message || !resp.choices[0].message.content) {
      throw new Error("No response from Together AI");
    }

    messages.push({ role: "assistant", content: resp.choices[0].message.content });
    return messages;
  }

  // Unused together.ai implementation
  // public async getResponse(messages: Message[]): Promise<Message[]> {
  //   const resp = await this.together.chat.completions.create({
  //     messages: messages,
  //     model: "meta-llama/Llama-2-70b-chat-hf",
  //   });

  //   if (!resp.choices || !resp.choices[0].message || !resp.choices[0].message.content) {
  //     throw new Error("No response from Together AI");
  //   }

  //   messages.push({ role: "assistant", content: resp.choices[0].message.content });
  //   return messages;
  // }
}

const togetherAIClient = new TogetherAI();
export default togetherAIClient;

import Together from "together-ai";
import OpenAI from "openai";
import voiceAgentService, { Message } from "../service/voiceAgent.ts";

class TogetherAI {
  private client: Together;
  private openai: OpenAI;

  constructor() {
    this.client = new Together({
      apiKey: process.env["TOGETHER_AI_API_KEY"],
    });
    const openaiAPIKey = process.env["OPENAI_API_KEY"];
    if (!openaiAPIKey) {
      throw new Error("OpenAI API key is missing");
    }
    this.openai = new OpenAI({
      organization: process.env["OPENAI_API_ORG"],
      project: process.env["OPENAI_API_PROJECT"],
    });
  }
//   public async getResponse(messages: Message[]): Promise<Message[]> {
//     const resp = await this.openai.chat.completions.create({
//       messages: messages,
//       model: "gpt-4o",
//       stream: true,
//     });

//     let text = "";

//     return new Promise(async (resolve, reject) => {
//       try {
//         for await (const chunk of resp) {
//           const content = chunk.choices[0].delta.content;

//           console.log(chunk.choices[0].delta.content, chunk.choices[0].finish_reason);
//           if (chunk.choices[0].delta.content && chunk.choices[0].finish_reason === "stop") {
//             messages.push({ role: "assistant", content: text });
//           }
    
//           if (chunk.choices[0].delta.content) {
//             await voiceAgentService.speak(chunk.choices[0].delta.content);
//             text += content;
//           }

//         }

//         messages.push({ role: "assistant", content: text });
//         resolve(messages);
//       } catch (err) {
//         reject(err);
//       }
//     });
//   }

// }

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
}
//   public async getResponse(messages: Message[]): Promise<Message[]> {
//     console.log("Getting response from Together AI");
//     const resp = await this.client.chat.completions.create({
//       messages: messages,
//       model: "meta-llama/Llama-2-70b-chat-hf",
//       // model: "meta-llama/Llama-2-70b-hf",
//     });
//     console.log("Response from Together AI:", resp);

//     if (!resp.choices || !resp.choices[0].message || !resp.choices[0].message.content) {
//       throw new Error("No response from Together AI");
//     }

//     messages.push({ role: "assistant", content: resp.choices[0].message.content });
//     return messages;
//   }
// }

const togetherAIClient = new TogetherAI();
export default togetherAIClient;

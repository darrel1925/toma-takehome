import Together from "together-ai";

class TogetherAI {
  private client: Together;

  constructor() {
    this.client = new Together({
      apiKey: process.env["TOGETHER_AI_API_KEY"],
    });
  }

  public async getResponse(message: string, messages: any[]) {
    messages.push({ role: "user", content: message });

    const resp = await this.client.chat.completions.create({
      messages: [...messages],
      model: "meta-llama/Llama-2-70b-chat-hf",
    });

    if (!resp || !resp.choices || !resp.choices[0] || !resp.choices[0].message) {
      throw new Error("No response from Together AI");
    }

    messages.push({ role: "assistant", content: resp.choices[0].message.content });
    console.log("Messages:", messages);
    return messages;
  }
}

const togetherAIClient = new TogetherAI();
export default togetherAIClient;

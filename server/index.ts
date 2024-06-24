import "dotenv/config";
import voiceAgentService from "./service/voiceAgent.js";

async function main() {
  voiceAgentService.startConversation();
}

main().catch((err) => console.error(err));

import "dotenv/config";
import voiceAgentService from "./service/voiceAgent.js";

async function main() {
  voiceAgentService.handleConversation();
}

main().catch((err) => console.error(err));

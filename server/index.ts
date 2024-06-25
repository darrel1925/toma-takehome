import "dotenv/config";
import voiceAgentService from "./service/voiceAgent.js";

async function main() {
  voiceAgentService.startConversation();
}

// Entry point to the application
main().catch((err) => console.error(err));

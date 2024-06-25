import deepgramClient from "../clients/deepgram.js";
import togetherAIClient from "../clients/togetherai.js";
import {
  initialMessages,
  INITIAL_INTENT,
  OIL_CHANGE_INTENT as OIL_CHANGE_CTX,
  SERVICE_OPTIONS_INTENT as SERVICE_CTX,
  RESPONSE_FORMATTING,
  RECOMMEND_SERVICE_INTENT as RECOMMEND_SERVICE_CTX,
  UNKNOWN_INTENT as UNKNOWN_CTX,
  BATTERY_REPLACEMENT_INTENT as BATTERY_REPLACEMENT_CTX,
  TIRE_ROTATION_INTENT as TIRE_ROTATION_CTX,
  WINDSHIELD_WIPER_REPLACEMENT as WINDSHIELD_WIPER_CTX,
  CHARGING_PORT_DIAGNOSIS_INTENT as CHARGING_PORT_DIAGNOSIS_CTX,
} from "../utils/prompts.js";

enum Intent {
  INITIAL, // The conversation has just started
  SERVICE_OPTIONS, // Users is asking what services are available
  BATTERY_REPLACEMENT, // User is asking about battery replacement
  CHARGING_PORT_DIAGNOSIS, // User is asking about charging port diagnosis
  FACTORY_MAINTENANCE, // User is asking about factory recommended maintenance
  OIL_CHANGE, // User is asking about oil change
  TIRE_ROTATION, // User is asking about tire rotation
  WINDSHIELD_WIPER_REPLACEMENT, // User is asking about windshield wiper replacement
  WINDSHIELD_REPLACEMENT, // User is asking about windshield replacement
  RECOMMEND_SERVICE, // User is asking for a service recommendation
  CONFIRM_APPOINTMENT, // User is confirming an appointment
  SUGGEST_AVAILABILITY, // User is asking for availability
  UNKNOWN, // It is unclear what the user is asking
}

interface UserContext {
  firstName: string;
  lastName: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  desiredService: string;
  appointmentTime: string;
  appointmentDayOfWeek: string;
}

type Role = "user" | "assistant" | "system";

export interface Message {
  role: Role;
  content: string;
}

/**
 * VoiceAgentService class to handle interactions with the user via voice.
 * This class uses Deepgram for speech-to-text and text-to-speech, and an LLM for processing responses.
 */
class VoiceAgentService {
  private userContext: UserContext;
  private messages: Message[];

  constructor() {
    this.userContext = {
      firstName: "",
      lastName: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      desiredService: "",
      appointmentTime: "",
      appointmentDayOfWeek: "",
    };
    this.messages = initialMessages;
  }

  async startConversation(): Promise<void> {
    // Start conversation
    await this.speak("Welcome to our service center. How can I help you today?");

    // Listen to user
    let userResp = await this.listenToUser();

    // Get response from LLM
    await this.getLLMResp(userResp, INITIAL_INTENT);
    let { resp: initialResp, context: initialContext } = this.identifyIntent();

    // Speak
    await this.speak(initialResp);

    let currentContext = initialContext;
    while (true) {
      // Listen to user
      userResp = await this.listenToUser();

      // Get response from LLM
      await this.getLLMResp(userResp, currentContext);
      let { resp: newResp, context: newContext } = this.identifyIntent();

      // Speak
      await this.speak(newResp);

      // Update conversation context
      currentContext = newContext;
    }
  }

  /**
   * Speaks the given question to the user.
   * @param question - The question to speak to the user.
   */
  private async speak(question: string): Promise<void> {
    console.log("Asking user:", question);
    await deepgramClient.textToSpeech(question); // Wait for the audio to finish playing
  }

  /**
   * Listens to the user's response using the microphone.
   * @returns The transcribed text of the user's response.
   */
  private  async listenToUser(): Promise<string> {
    const userAnswer = await deepgramClient.microphoneToText();
    console.log("User answered:", userAnswer);
    return userAnswer;
  }

  /**
   * Gets the response from the LLM model based on the user's response and conversation context.
   * @param userResp - The user's response.
   * @param messages - The conversation context.
   * @returns The updated conversation context including the LLM's response.
   */
  private async  getLLMResp(userResp: string, context: string): Promise<any[]> {
    const formattedResponse =
      RESPONSE_FORMATTING +
      context
        .replace("{user_info}", JSON.stringify(this.userContext))
        .replace("{user_response}", userResp);

    this.messages.push({ role: "user", content: formattedResponse });
    const updatedMessages = await togetherAIClient.getResponse(this.messages);
    this.messages = updatedMessages;
    return updatedMessages;
  }

  private updateUserContext(json: UserContext) {
    this.userContext = {
      ...this.userContext,
      ...json,
    };
  }

  private identifyIntent(): { resp: string; context: string } {
    const recentMessage = this.messages[this.messages.length - 1].content;
    const [intent, jsonStr, llmResp] = recentMessage.split("::");

    console.log("intent", intent);
    console.log("jsonStr", jsonStr);

    const json: UserContext = JSON.parse(jsonStr);
    this.updateUserContext(json);

    const intentMapping: Record<string, string> = {
      SERVICE_OPTIONS: SERVICE_CTX,
      BATTERY_REPLACEMENT: BATTERY_REPLACEMENT_CTX,
      CHARGING_PORT_DIAGNOSIS: CHARGING_PORT_DIAGNOSIS_CTX,
      FACTORY_RECOMMENDED_MAINTENANCE: "",
      OIL_CHANGE: OIL_CHANGE_CTX,
      TIRE_ROTATION: TIRE_ROTATION_CTX,
      WINDSHIELD_WIPER_REPLACEMENT: WINDSHIELD_WIPER_CTX,
      RECOMMEND_SERVICE: RECOMMEND_SERVICE_CTX,
      CONFIRM_APPOINTMENT: "",
      SUGGEST_AVAILABILITY: "",
      UNKNOWN: UNKNOWN_CTX,
    };

    return { resp: llmResp, context: intentMapping[intent] };
  }
}

const voiceAgentService = new VoiceAgentService();
export default voiceAgentService;

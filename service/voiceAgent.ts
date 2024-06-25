import deepgramClient from "../clients/deepgram.js";
import togetherAIClient from "../clients/togetherai.js";
import {
  initialMessages,
  INITIAL_INTENT_CTX,
  OIL_CHANGE_CTX,
  SERVICE_OPTIONS_CTX,
  RESPONSE_FORMATTING,
  RECOMMEND_SERVICE_CTX,
  UNKNOWN_INTENT_CTX,
  BATTERY_REPLACEMENT_CTX,
  TIRE_ROTATION_CTX,
  WINDSHIELD_WIPER_CTX,
  CHARGING_PORT_DIAGNOSIS_CTX,
  FACTORY_MAINTENANCE_CTX,
  SUGGEST_AVAILABILITY_CTX,
  CONFIRM_APPOINTMENT_CTX,
} from "../utils/prompts.js";

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
const defaultUserContext: UserContext = {
  firstName: "",
  lastName: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  desiredService: "",
  appointmentTime: "",
  appointmentDayOfWeek: "",
};

/**
 * VoiceAgentService class to handle interactions with the user via voice.
 * This class uses Deepgram for speech-to-text and text-to-speech, and an LLM for processing responses.
 */
class VoiceAgentService {
  private userContext: UserContext; // Additional information about the user's conversation
  private messages: Message[]; // Conversation with user and assistant

  constructor() {
    this.userContext = defaultUserContext;
    this.messages = initialMessages;
  }

  async startConversation(): Promise<void> {
    // Start conversation
    await this.speak("Welcome to our service center. How can I help you today?");

    // Listen to user
    let userResp = await this.listenToUser();

    // Get response from LLM
    await this.getLLMResp(userResp, INITIAL_INTENT_CTX);
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

  // Speaks the given response to the user.
  private async speak(response: string): Promise<void> {
    console.log("Assistant:", response, "\n");
    await deepgramClient.textToSpeech(response); // Wait for the audio to finish playing
  }

  /**
   * Listens to the user's response using the microphone.
   * @returns The transcribed text of the user's response.
   */
  private async listenToUser(): Promise<string> {
    const userAnswer = await deepgramClient.microphoneToText();
    console.log("User:", userAnswer, "\n");
    return userAnswer;
  }

  /**
   * Gets the response from the LLM model based on the user's response and conversation context.
   * @param userResp - The user's response.
   * @param context - Additional info to to help guide the LLM based on the user's intent.
   * @returns The response from the LLM model.
   */
  private async getLLMResp(userResp: string, context: string): Promise<any[]> {
    // Add any information we know about the user to help guide the LLM
    const formattedResponse =
      RESPONSE_FORMATTING +
      context
        .replace("{user_info}", JSON.stringify(this.userContext))
        .replace("{user_response}", userResp);

    // Add the user's response to the conversation
    this.messages.push({ role: "user", content: formattedResponse });

    // Get response from LLM
    const updatedMessages = await togetherAIClient.getResponse(this.messages);

    // Update the conversation with the LLM response
    this.messages = updatedMessages;
    return updatedMessages;
  }

  /**
   * Identifies the intent of the user's most recent message and the context needed for the next conversation step.
   *
   * IMPORTANT:
   * The intent is determined by the LLM's response, which is formatted as [Intent]::[User Info JSON]::[LLM Response].
   * The LLM determines the intent based on the user's most recent message. This is the brains of the voice agent.
   * This context is crucial for determining the next steps in the conversation.
   *
   * Workflow:
   * 1. Extract the recent message from the conversation history.
   * 2. Split the message into intent, user information (as JSON string), and language model response.
   * 3. Parse the JSON string to update the user context.
   * 4. Use extracted intent to determine what context is needed for the next conversation step.
   *
   */
  private identifyIntent(): { resp: string; context: string } {
    const recentMessage = this.messages[this.messages.length - 1].content;

    // Extract the intent and user information from the recent message
    // Format is [Intent]::[User Info JSON]::[LLM Response]
    const [intent, jsonStr, llmResp] = recentMessage.split("::");

    // Update class with new information about the user
    const json: UserContext = JSON.parse(jsonStr);
    this.updateUserContext(json);

    console.log(`[Intent: ${intent}  User Info: ${this.getFormattedUserData()}]`);

    // Get the context needed for the next conversation based on the intent
    const intentMapping: Record<string, string> = {
      // User is asking what services are available
      SERVICE_OPTIONS: SERVICE_OPTIONS_CTX,
      // User is asking about battery replacement
      BATTERY_REPLACEMENT: BATTERY_REPLACEMENT_CTX,
      // User is asking about charging port diagnosis
      CHARGING_PORT_DIAGNOSIS: CHARGING_PORT_DIAGNOSIS_CTX,
      // User is asking about factory recommended maintenance
      FACTORY_RECOMMENDED_MAINTENANCE: FACTORY_MAINTENANCE_CTX,
      // User is asking about oil change
      OIL_CHANGE: OIL_CHANGE_CTX,
      // User is asking about tire rotation
      TIRE_ROTATION: TIRE_ROTATION_CTX,
      // User is asking about windshield wiper replacement
      WINDSHIELD_WIPER_REPLACEMENT: WINDSHIELD_WIPER_CTX,
      // User is asking for a service recommendation
      RECOMMEND_SERVICE: RECOMMEND_SERVICE_CTX,
      // User is asking for availability
      SUGGEST_AVAILABILITY: SUGGEST_AVAILABILITY_CTX,
      // User is confirming an appointment
      CONFIRM_APPOINTMENT: CONFIRM_APPOINTMENT_CTX,
      // It is unclear what the user is asking
      UNKNOWN: UNKNOWN_INTENT_CTX,
    };

    return { resp: llmResp, context: intentMapping[intent] };
  }

  // Update the user context with new information received from the LLM
  private updateUserContext(json: UserContext) {
    this.userContext = {
      ...this.userContext,
      ...json,
    };
  }
  // For logging
  private getFormattedUserData() {
    return `First Name: [${this.userContext.firstName}] Last Name: [${this.userContext.lastName}] Vehicle Make: [${this.userContext.vehicleMake}] Vehicle Model: [${this.userContext.vehicleModel}] Vehicle Year: [${this.userContext.vehicleYear}] Desired Service: [${this.userContext.desiredService}] Appointment Time: [${this.userContext.appointmentTime}] Appointment Day of Week: [${this.userContext.appointmentDayOfWeek}]`;
  }
}

const voiceAgentService = new VoiceAgentService();
export default voiceAgentService;

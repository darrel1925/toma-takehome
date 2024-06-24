import { isPrimitive } from "util";
import deepgramClient from "../clients/deepgram.js";
import togetherAIClient from "../clients/togetherai.js";
import { User } from "../models/user.js";
import {
  initialMessages,
  INITIAL_INTENT,
  OIL_CHANGE_INTENT,
  SERVICE_OPTIONS_INTENT,
  RESPONSE_FORMATTING,
  RECOMMEND_SERVICE_INTENT,
  UNKNOWN_INTENT,
  BATTERY_REPLACEMENT_INTENT,
  TIRE_ROTATION_INTENT,
  WINDSHIELD_WIPER_REPLACEMENT as WINDSHIELD_WIPER_REPLACEMENT_INTENT,
  CHARGING_PORT_DIAGNOSIS_INTENT,
} from "../utils/prompts.js";
import { json } from "stream/consumers";

enum Intent {
  INITIAL, // The conversation has just started
  SERVICE_OPTIONS, // Users is asking what services are available
  BATTERY_REPLACEMENT, // User is asking about battery replacement
  CHARGING_PORT_DIAGNOSIS, // User is asking about charging port diagnosis
  FACTORY_RECOMMENDED_MAINTENANCE, // User is asking about factory recommended maintenance
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

const stellantis = [
  "Abarth",
  "Alfa Romeo",
  "Chrysler",
  "Citroën",
  "Dodge",
  "DS",
  "Fiat",
  "Jeep",
  "Lancia",
  "Maserati",
  "Opel",
  "Peugeot",
  "Ram",
  "Vauxhall",
];

/**
 * VoiceAgentService class to handle interactions with the user via voice.
 * This class uses Deepgram for speech-to-text and text-to-speech, and an LLM for processing responses.
 */
class VoiceAgentService {
  private userContext: UserContext;
  private messages: Message[];
  private intent: Intent = Intent.INITIAL;

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

  /**
   * Speaks the given question to the user.
   * @param question - The question to speak to the user.
   */
  async speak(question: string): Promise<void> {
    console.log("Asking user:", question);
    await deepgramClient.textToSpeech(question); // Wait for the audio to finish playing
  }

  /**
   * Listens to the user's response using the microphone.
   * @returns The transcribed text of the user's response.
   */
  async listenToUser(): Promise<string> {
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
  async getLLMResp(userResp: string): Promise<any[]> {
    this.messages.push({ role: "user", content: userResp });
    const updatedMessages = await togetherAIClient.getResponse(this.messages);
    this.messages = updatedMessages;
    return updatedMessages;
  }

  updateUserContext(json: UserContext) {
    this.userContext = {
      ...this.userContext,
      ...json,
    };
  }

  /**
   * Identifies the intent from the user's response.
   * @param userResp - The user's response.
   * @returns The identified intent.
   */
  identifyIntent(): { intent: Intent; resp: string } {
    const recentMessage = this.messages[this.messages.length - 1].content;
    const [intent, jsonStr, llmResp] = recentMessage.split("::");

    console.log("Intent:", intent);
    console.log("JSON:", jsonStr);

    let json: UserContext = JSON.parse(jsonStr);
    this.updateUserContext(json);

    // Get first word from the LLM response
    if (intent === "SERVICE_OPTIONS") {
      return { intent: Intent.SERVICE_OPTIONS, resp: llmResp };
    } else if (intent === "BATTERY_REPLACEMENT") {
      return { intent: Intent.BATTERY_REPLACEMENT, resp: llmResp };
    } else if (intent === "CHARGING_PORT_DIAGNOSIS") {
      return { intent: Intent.CHARGING_PORT_DIAGNOSIS, resp: llmResp };
    } else if (intent === "FACTORY_RECOMMENDED_MAINTENANCE") {
      return { intent: Intent.FACTORY_RECOMMENDED_MAINTENANCE, resp: llmResp };
    } else if (intent === "OIL_CHANGE") {
      return { intent: Intent.OIL_CHANGE, resp: llmResp };
    } else if (intent === "TIRE_ROTATION") {
      return { intent: Intent.TIRE_ROTATION, resp: llmResp };
    } else if (intent === "WINDSHIELD_WIPER_REPLACEMENT") {
      return { intent: Intent.WINDSHIELD_WIPER_REPLACEMENT, resp: llmResp };
    } else if (intent === "WINDSHIELD_REPLACEMENT") {
      return { intent: Intent.WINDSHIELD_REPLACEMENT, resp: llmResp };
    } else if (intent === "RECOMMEND_SERVICE") {
      return { intent: Intent.RECOMMEND_SERVICE, resp: llmResp };
    } else if (intent === "CONFIRM_APPOINTMENT") {
      return { intent: Intent.CONFIRM_APPOINTMENT, resp: llmResp };
    } else if (intent === "SUGGEST_AVAILABILITY") {
      return { intent: Intent.SUGGEST_AVAILABILITY, resp: llmResp };
    }

    return { intent: Intent.UNKNOWN, resp: llmResp };
  }

  async handleConversation(): Promise<void> {
    let question = "";
    // deepgramClient.initMicrophone();
    await this.speak("Welcome to our service center. How can I help you today?");
    let userResp = await this.listenToUser();

    // json to string
    await this.getLLMResp(
      RESPONSE_FORMATTING +
        INITIAL_INTENT.replace("{user_info}", JSON.stringify(this.userContext)).replace(
          "{user_response}",
          userResp
        )
    );

    let response = this.identifyIntent();
    this.intent = response.intent;
    await this.speak(response.resp);

    while (true) {
      const userResp = await this.listenToUser();

      switch (this.intent) {
        case Intent.OIL_CHANGE:
          question = OIL_CHANGE_INTENT;
          break;
        case Intent.SERVICE_OPTIONS:
          question = SERVICE_OPTIONS_INTENT;
          break;
        case Intent.RECOMMEND_SERVICE:
          question = RECOMMEND_SERVICE_INTENT;
          break;
        case Intent.BATTERY_REPLACEMENT:
          question = BATTERY_REPLACEMENT_INTENT;
          break;
        case Intent.TIRE_ROTATION:
          question = TIRE_ROTATION_INTENT;
          break;
        case Intent.WINDSHIELD_WIPER_REPLACEMENT:
          question = WINDSHIELD_WIPER_REPLACEMENT_INTENT;
          break;
        case Intent.CHARGING_PORT_DIAGNOSIS:
          question = CHARGING_PORT_DIAGNOSIS_INTENT;
          break;
        case Intent.UNKNOWN:
          question = UNKNOWN_INTENT;
          break;
      }

      await this.getLLMResp(
        RESPONSE_FORMATTING +
          question
            .replace("{user_info}", JSON.stringify(this.userContext))
            .replace("{user_response}", userResp)
      );
      let response = this.identifyIntent();
      this.intent = response.intent;
      await this.speak(response.resp);
    }
  }
}

const voiceAgentService = new VoiceAgentService();
export default voiceAgentService;

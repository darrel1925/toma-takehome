import { isPrimitive } from "util";
import deepgramClient from "../clients/deepgram.js";
import togetherAIClient from "../clients/togetherai.js";
import { User } from "../models/user.js";
import {
  initialMessageCarInfo,
  initialMessageIsElectric,
  initialMessageName,
} from "../utils/prompts.js";

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
  async getLLMResp(userResp: string, messages: any[]): Promise<any[]> {
    const updatedMessages = await togetherAIClient.getResponse(userResp, messages);
    return updatedMessages;
  }

  /**
   * Initiates a conversation to collect the user's full name.
   * @returns A User object containing the user's first and last name.
   */
  async startNameConversation(): Promise<User> {
    const initialConversation = initialMessageName;
    const startingQuestion = initialMessageName[1].content;
    await this.speak(startingQuestion);
    let user = new User();

    while (!user.first_name || !user.last_name) {
      // Wait for the user to respond
      const userResp = await this.listenToUser();
      // Get the response from the LLM model
      const updatedMessages = await this.getLLMResp(userResp, initialConversation);

      // Get the response and JSON from the LLM model
      const llmResponse = updatedMessages[updatedMessages.length - 1].content;
      const [jsonStr, llmResp] = llmResponse.split("::");
      const llmJSON = JSON.parse(jsonStr);

      // Update the user's first and last name
      user.first_name = llmJSON.first_name;
      user.last_name = llmJSON.last_name;

      console.log("Response from LLM:", llmJSON);

      if (user.first_name != "" && user.last_name != "") {
        break;
      }
      // Speak the response
      await this.speak(llmResp);
    }

    console.log("User's first name:", user.first_name);
    console.log("User's last name:", user.last_name);
    console.log("Name conversation ended.");

    return user;
  }

  /**
   * Initiates a conversation to collect the user's vehicle information.
   * @param user - A User object containing the user's name.
   * @returns A User object containing the user's name and vehicle information.
   */
  async getCarInformation(user: User): Promise<User> {
    const initialConversation = initialMessageCarInfo;
    const startingQuestion = initialMessageCarInfo[1].content;
    await this.speak(startingQuestion);

    while (!user.make || !user.model || !user.year) {
      // Wait for the user to respond
      const userResp = await this.listenToUser();
      // Get the response from the LLM model
      const updatedMessages = await this.getLLMResp(userResp, initialConversation);

      // Get the response and JSON from the LLM model
      const llmResponse = updatedMessages[updatedMessages.length - 1].content;
      const [jsonStr, llmResp] = llmResponse.split("::");
      const llmJSON = JSON.parse(jsonStr);

      // Update the user's vehicle information
      user.make = llmJSON.make;
      user.model = llmJSON.model;
      user.year = parseInt(llmJSON.year, 10);

      console.log("Response from LLM:", llmJSON);

      if (user.make != "" && user.model != "" && user.year != 0) {
        break;
      }

      // Speak the response
      await this.speak(llmResp);
    }

    console.log("User's vehicle make:", user.make);
    console.log("User's vehicle model:", user.model);
    console.log("User's vehicle year:", user.year);
    console.log("Car information conversation ended.");

    return user;
  }

  async recommendService(user: User): Promise<string> {
    if (stellantis.includes(user.make)) {
      return "Factory-recommended maintenance if your vehicle hit 50k miles.";
    }

    const carMakeModel = `${user.year} ${user.make} ${user.model}`;

    const updatedMessages = await this.getLLMResp(carMakeModel, initialMessageIsElectric);
    // parse string to JSON
    const llmResponse = updatedMessages[updatedMessages.length - 1].content;
    const isElectric = JSON.parse(llmResponse);
    console.log("Is electric:", isElectric);
    console.log("Response from LLM:", llmResponse);

    if (isElectric.isElectric) {
      return "Battery replacement, charging port diagnosis.";
    }

    return "Oil change, tire rotation, brake inspection.";
  }

  /**
   * Starts the complete conversation to collect both the user's name and vehicle information.
   * @returns A User object containing the user's name and vehicle information.
   */
  async startConversation(): Promise<User> {
    let user = await this.startNameConversation();
    user = await this.getCarInformation(user);
    const serviceRecommendation = await this.recommendService(user);
    this.speak(serviceRecommendation);
    console.log("Service recommendation:", serviceRecommendation);

    return user;
  }
}

const voiceAgentService = new VoiceAgentService();
export default voiceAgentService;

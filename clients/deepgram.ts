import waveFileService from "../service/waveFileService.ts";
import fs from "fs";
import https from "https";
import player from "play-sound";
import Mic from "node-microphone";
import { createClient, LiveTranscriptionEvents, DeepgramClient } from "@deepgram/sdk";
import { Writable } from "stream";
import { IncomingMessage } from "http";

const url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en";
const SILENCE_TIMEOUT = 2000; // 2 seconds of silence to determine end of speech

export class DeepgramInternal {
  private deepgram: DeepgramClient;
  private apiKey: string;
  private audioPlayer: any;

  constructor() {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      throw new Error("Deepgram API key is missing");
    }
    this.apiKey = deepgramApiKey;
    this.deepgram = createClient(deepgramApiKey);
    this.audioPlayer = player();
  }

  async microphoneToText(): Promise<string> {
    const micStream = this.getMicrophoneStream(); // microphone stream to capture audio input
    let silenceTimer: NodeJS.Timeout; // Timer to detect silence
    let transcript = ""; // Track words spoken by the user

    return new Promise((resolve, reject) => {
      const connection = this.deepgram.listen.live({
        model: "nova-2",
        language: "en",
        smart_format: true, // Enable smart formatting for better readability
      });

      // Ends conversation when silence is detected
      function resetSilenceTimer() {
        // If there is an existing silence timer, clear it
        if (silenceTimer) {
          clearTimeout(silenceTimer);
        }

        // @ts-ignore
        silenceTimer = setTimeout(() => {
          // If no speech is detected, continue listening
          if (transcript.trim().length === 0) {
            console.log("[No speech detected. Still listening ...]");
            return;
          }

          // Silence detected. Close connection
          resolve(transcript);
          micStream.destroy();
        }, SILENCE_TIMEOUT);
      }

      // Listen to events from deepgram STT
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("[Listening for user response...]");

        // Send the microphone audio stream to deepgram STT
        micStream.on("data", (chunk: Buffer) => {
          // Convert the audio to 8kHz mu-law
          const optimizedChunk = waveFileService.bufferTo8kHzMulaw(chunk);
          connection.send(optimizedChunk);
        });

        // Close connection when the microphone stream ends
        micStream.on("close", () => {
          connection.finish();
        });

        // Fires when a new transcript is received from Deepgram
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          if (data.channel.alternatives[0].transcript) {
            transcript += ` ${data.channel.alternatives[0].transcript}`;
          }
          // Reset the silence timer to continue receiving a new text
          resetSilenceTimer();
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
          reject(err);
        });
      });
    });
  }

  textToSpeech(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Define the payload
      const data = JSON.stringify({ text });

      // Define the options for the HTTP request
      const options = {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      };

      // Make the POST request to Deepgram's TTS
      const req = https.request(url, options, (res: IncomingMessage) => {
        // If error
        if (res.statusCode !== 200) {
          console.error(`HTTP error! Status: ${res.statusCode}`);
          reject(new Error(`HTTP error! Status: ${res.statusCode}`));
          return;
        }

        // Play the audio from the response stream
        this.playAudioFromStream(res, resolve);
      });

      // Handle potential errors
      req.on("error", (error: Error) => {
        console.error("Error:", error);
        reject(error);
      });

      // Send the request with the payload
      req.write(data);
      req.end();
    });
  }

  // Function to play audio from a stream
  private playAudioFromStream(stream: IncomingMessage, callback: () => void) {
    // File path to save the audio stream for playback
    const tempFilePath = "temp.mp3";

    // Save the stream to a temporary file and play it
    const tempFile = fs.createWriteStream(tempFilePath);
    stream.pipe(tempFile); // Pipe the stream data to the temporary file

    // Once the file has been fully written, play the audio
    tempFile.on("finish", () => {
      this.audioPlayer.play(tempFilePath, (err: Error) => {
        if (err) {
          console.error("Error playing audio:", err);
        }
        // Remove the temporary file after playing
        fs.unlink(tempFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Error removing temp file:", unlinkErr);
          }
        });
        callback(); // Resolve the promise once audio playback is finished
      });
    });
  }

  // Gets microphone stream for recording audio
  private getMicrophoneStream(): Writable {
    const microphone = new Mic(); // Create a new instance
    return microphone.startRecording(); // Start recording and return the Writable stream
  }
}

const deepgramClient = new DeepgramInternal();
export default deepgramClient;

// server/service/voiceAgent.ts

import { createClient, LiveTranscriptionEvents, DeepgramClient } from "@deepgram/sdk";
import Mic from "node-microphone";
import { Writable } from "stream";
import https from "https";
import fs from "fs";
import { IncomingMessage } from "http";
import player from "play-sound";
import Microphone from "node-microphone";
import MicrophoneStream from "microphone-stream";
import { channel } from "diagnostics_channel";

const url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en";
const SILENCE_TIMEOUT = 2000; // 3 seconds of silence to determine end of speech

export class DeepgramInternal {
  private deepgram: DeepgramClient;
  private apiKey: string;
  private audioPlayer: any;
  private micStream: Writable;

  constructor() {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      throw new Error("Deepgram API key is missing");
    }
    this.apiKey = deepgramApiKey;
    this.deepgram = createClient(deepgramApiKey);
    this.audioPlayer = player();
    this.micStream = new Writable();
  }

  openNewMicStream() {
    this.micStream = getMicrophoneStream();
  }

  /**
   * Transcribes speech from the microphone in real-time.
   *
   * This function sets up a microphone stream, sends the audio data to Deepgram for live transcription,
   * and handles the transcription events. It stops the transcription when silence is detected.
   *
   * @returns {Promise<string>} - A promise that resolves to the transcribed text.
   */
  async microphoneToText(): Promise<string> {
    // STEP 1: Get the microphone stream to capture audio input
    this.openNewMicStream();
    let silenceTimer: NodeJS.Timeout;

    return new Promise((resolve, reject) => {
      // STEP 2: Create a live transcription connection with Deepgram
      const connection = this.deepgram.listen.live({
        model: "nova-2", // Use the 'nova-2' model for transcription optimized for phone calls
        language: "en", // Set the language to English
        // vad_events: true, // Enable voice activity detection events
        // punctuate: true, // Enable punctuation for better readability
        smart_format: true, // Enable smart formatting for better readability
        filler_words: true, // Enable filler words so we don't misinterpret them as silence
      });

      // Initialize variables for managing the transcript and silence detection
      let transcript = "";

      /**
       * Resets the silence detection timer.
       * If no audio is received for the duration of SILENCE_TIMEOUT, the transcription is stopped.
       */
      function resetSilenceTimer() {
        if (silenceTimer) {
          console.log("Resetting silence timer.");
          clearTimeout(silenceTimer);
        }

        silenceTimer = setTimeout(() => {
          if (transcript.trim().length === 0) {
            console.log("No speech detected. Still listening...");
            return;
          }

          console.log("Silence detected. Closing connection.");
          resolve(transcript);
          deepgramClient.micStream.destroy(); // Close the microphone stream
        }, SILENCE_TIMEOUT);
      }

      // STEP 3: Listen for events from the live transcription connection
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("Listening for user response...");

        // STEP 4: Send the microphone audio stream to the live transcription connection
        this.micStream.on("data", (chunk: Buffer) => {
          try {
            connection.send(chunk); // Send the optimized audio chunk to Deepgram
          } catch (error) {
            console.log("Chunk not sent.");
          }
        });

        this.micStream.on("end", () => {
          console.log("Microphone stream ended.");
          connection.finish(); // Close the connection when the microphone stream ends
        });

        this.micStream.on("destroy", () => {
          console.log("Microphone stream destroy.");
          connection.finish(); // Close the connection when the microphone stream ends
        });

        this.micStream.on("close", () => {
          console.log("Microphone stream close.");
          connection.finish(); // Close the connection when the microphone stream ends
        });

        // Event fired when the connection to Deepgram is closed
        connection.on(LiveTranscriptionEvents.Close, () => {
          console.log("Connection closed.");
        });

        // Fires when a new transcript is received from Deepgram
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          console.log("Transcript:", transcript);
          if (data.channel.alternatives[0].transcript) {
            transcript += ` ${data.channel.alternatives[0].transcript}`;
          }
          // Reset the silence timer to continue receiving a new text
          resetSilenceTimer();
        });

        connection.on(LiveTranscriptionEvents.Metadata, (data) => {
          // console.log("Metadata:", data);
        });

        connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error("Error:", err);
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

      // Make the POST request
      const req = https.request(url, options, (res: IncomingMessage) => {
        // Check if the response is successful
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

  // Helper function to play audio from a stream
  playAudioFromStream(stream: IncomingMessage, callback: () => void) {
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
}

/**
 * Helper function to get microphone stream.
 *
 * This function initializes the microphone on user's device and starts recording.
 * It returns a Writable stream which can be used to read audio data from the microphone.
 *
 * @returns {Promise<Writable>} - The Writable stream from the microphone.
 * @throws {Error} - If there is an issue with starting the microphone recording.
 */
function getMicrophoneStream(): Writable {
  // brew install sox
  const microphone = new Mic(); // Create a new instance of the node-microphone
  return microphone.startRecording(); // Start recording and return the Writable stream
}

const deepgramClient = new DeepgramInternal();
export default deepgramClient;

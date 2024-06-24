// server/service/voiceAgent.ts

import { createClient, LiveTranscriptionEvents, DeepgramClient } from "@deepgram/sdk";
import Mic from "node-microphone";
import { Writable } from "stream";
import https from "https";
import fs from "fs";
import { IncomingMessage } from "http";
import player from "play-sound";

const url = "https://api.deepgram.com/v1/speak?model=aura-asteria-en";
const SILENCE_TIMEOUT = 2000; // 3 seconds of silence to determine end of speech

export class DeepgramInternal {
  private deepgram: DeepgramClient;
  private apiKey: string;

  constructor() {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramApiKey) {
      throw new Error("Deepgram API key is missing");
    }
    this.apiKey = deepgramApiKey;
    this.deepgram = createClient(deepgramApiKey);
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
    const micStream = await getMicrophoneStream();

    return new Promise((resolve, reject) => {
      // STEP 2: Create a live transcription connection with Deepgram
      const connection = this.deepgram.listen.live({
        model: "nova-2", // Use the 'nova-2' model for transcription
        language: "en-US", // Set the language to English
        smart_format: true, // Enable smart formatting for better readability
        // sample_rate: 8000, // Set the sample rate to 8kHz
        // encoding: "mulaw", // Set the encoding to mu-law
      });

      // Initialize variables for managing the transcript and silence detection
      let transcript = "";
      let silenceTimer: NodeJS.Timeout;
      let silenceDetected = false;

      /**
       * Resets the silence detection timer.
       * If no audio is received for the duration of SILENCE_TIMEOUT, the transcription is stopped.
       */
      function resetSilenceTimer() {
        if (silenceDetected) {
          return;
        }

        if (silenceTimer) {
          console.log("Resetting silence timer.");
          clearTimeout(silenceTimer);
        }

        silenceTimer = setTimeout(() => {
          console.log("Silence detected. Closing connection.");
          resolve(transcript);
          silenceDetected = true;
          micStream.destroy(); // Close the microphone stream
        }, SILENCE_TIMEOUT);
      }

      // STEP 3: Listen for events from the live transcription connection
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log("Connection opened.");

        // STEP 4: Send the microphone audio stream to the live transcription connection
        micStream.on("data", (chunk: Buffer) => {
          try {
            connection.send(chunk); // Send the optimized audio chunk to Deepgram
          } catch (error) {
            console.log("Chunk not sent.");
          }
        });

        micStream.on("end", () => {
          console.log("Microphone stream ended.");
          connection.finish(); // Close the connection when the microphone stream ends
        });

        micStream.on("destroy", () => {
          console.log("Microphone stream destroyç.");
          connection.finish(); // Close the connection when the microphone stream ends
        });

        micStream.on("close", () => {
          console.log("Microphone stream close.");
          connection.finish(); // Close the connection when the microphone stream ends
        });

        // Event fired when the connection to Deepgram is closed
        connection.on(LiveTranscriptionEvents.Close, () => {
          console.log("Connection closed.");
        });

        // Fires when a new transcript is received from Deepgram
        connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          if (data.channel.alternatives[0].transcript) {
            transcript += ` ${data.channel.alternatives[0].transcript}`;
            console.log("Transcript:", transcript);
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
    const audioPlayer = player();
    const tempFilePath = "temp.mp3";

    // Save the stream to a temporary file and play it
    const tempFile = fs.createWriteStream(tempFilePath);
    stream.pipe(tempFile); // Pipe the stream data to the temporary file

    // Once the file has been fully written, play the audio
    tempFile.on("finish", () => {
      audioPlayer.play(tempFilePath, (err: Error) => {
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
async function getMicrophoneStream(): Promise<Writable> {
  // brew install sox
  const microphone = new Mic(); // Create a new instance of the node-microphone
  return microphone.startRecording(); // Start recording and return the Writable stream
}

const deepgramClient = new DeepgramInternal();
export default deepgramClient;

// processAudioChunk(chunk: Buffer): Buffer {
//   // Convert the microphone chunk to 8kHz mu-law audio buffer
//   const wav = new WaveFile();
//   wav.fromScratch(1, 44100, "16", chunk); // Assume the input chunk is 44.1kHz, 16-bit PCM

//   // Resample to 8kHz
//   wav.toSampleRate(8000);

//   // Convert to mu-law
//   wav.toMuLaw();
//   const pcmBuffer = Buffer.from(wav.getSamples(true));
//   return pcmBuffer;
// }

// processAudioChunk(chunk: Buffer): Buffer {
//   try {
//     const wav = new WaveFile();

//     // Check if the chunk is a valid WAV file
//     if (!this.isValidWav(chunk)) {
//       console.log("Chunk is not a valid WAV file. Adding WAV header.");
//       chunk = this.addWavHeader(chunk);
//     }

//     wav.fromBuffer(chunk);
//     wav.toSampleRate(8000);
//     wav.toBitDepth("16");
//     const pcmBuffer = Buffer.from(wav.getSamples(true));

//     return pcmBuffer;
//   } catch (error) {
//     console.error("Failed to process audio chunk:", error);
//     console.log("Chunk:", chunk);
//     throw error;
//   }
// }

// isValidWav(chunk: Buffer): boolean {
//   const riffHeader = chunk.slice(0, 4).toString("ascii");
//   return riffHeader === "RIFF";
// }

// addWavHeader(chunk: Buffer): Buffer {
//   const sampleRate = 44100; // Assume original sample rate is 44100Hz
//   const numChannels = 1; // Mono
//   const bitDepth = 16; // 16-bit

//   const header = Buffer.alloc(44);
//   header.write("RIFF", 0, 4, "ascii");
//   header.writeUInt32LE(36 + chunk.length, 4);
//   header.write("WAVE", 8, 4, "ascii");
//   header.write("fmt ", 12, 4, "ascii");
//   header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
//   header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
//   header.writeUInt16LE(numChannels, 22);
//   header.writeUInt32LE(sampleRate, 24);
//   header.writeUInt32LE((sampleRate * numChannels * bitDepth) / 8, 28); // ByteRate
//   header.writeUInt16LE((numChannels * bitDepth) / 8, 32); // BlockAlign
//   header.writeUInt16LE(bitDepth, 34);
//   header.write("data", 36, 4, "ascii");
//   header.writeUInt32LE(chunk.length, 40);

//   return Buffer.concat([header, chunk]);
// }

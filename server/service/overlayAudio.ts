import { Response } from "express";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";

export async function overlayAudio(
  audio1Path: string,
  audio2Path: string,
  outputPath: string,
  res: Response
) {
  try {
    const path = "/Users/darrelmuonekwu/Desktop/audioNode/server/uploads/test.wav";
    const outputFilePath = await overlay(audio1Path, path, outputPath);
    res.download(outputFilePath, "output.m4a", (err) => {
      if (err) {
        console.error("Error sending file:", err);
      }
      // Clean up files
      fs.unlink(audio1Path, () => {});
      fs.unlink(audio2Path, () => {});
      fs.unlink(outputFilePath, () => {});
    });
  } catch (error) {
    res.status(500).send("Error processing audio files");
    console.error("Error processing audio files:", error);
  }
}

/**
 * Function to overlay audio2 over audio1 using FFmpeg
 * @param {string} audio1Path - Path to the main audio file
 * @param {string} audio2Path - Path to the overlay audio file
 * @param {string} outputPath - Path to save the output file
 * @returns {Promise<string>} - Returns the path to the output file
 */
function overlay(audio1Path: string, audio2Path: string, outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(audio1Path) // Input main audio file
      .input(audio2Path) // Input overlay audio file
      .complexFilter(["[0][1]amix=inputs=2:duration=first:dropout_transition=3"]) // Mix the two audio files
      .audioCodec("aac") // Set audio codec - efficiently compresses and stores analog audio to digital audio
      .save(outputPath) // Save the output file
      .on("end", () => {
        resolve(outputPath); // Resolve with the output file path on success
      })
      .on("error", (err: Error) => {
        reject(err); // Reject on error
      });
  });
}

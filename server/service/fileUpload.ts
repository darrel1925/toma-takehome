import { Response } from "express";
import ffmpeg from "fluent-ffmpeg";
import path from "path";
import multer from "multer";
import fs from "fs";

export const UPLOAD_DIR = "uploads/";
const CHUNK_DIR = "chunks/";
const PROCESSED_DIR = "processed/";

// Configure multer for file uploads
const storage = multer.diskStorage({
  // Set the destination directory for uploaded files
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  // Set the filename for uploaded files
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage: storage });

export async function processAudio(
  filePath: string,
  filename: string,
  pitch: string,
  speed: string,
  res: Response
) {
  // Ensure necessary directories exist
  [UPLOAD_DIR, CHUNK_DIR, PROCESSED_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  });
  try {
    // Split the audio file into chunks
    const chunkFiles = await splitAudioFile(filePath);

    // Process each chunk to modify its speed
    const processedChunkFiles = await Promise.all(
      chunkFiles.map((file) => modifyAudio(file, speed, pitch))
    );

    // Merge the processed chunks back together
    const outputFilePath = path.join(PROCESSED_DIR, `processed_${filename}`);
    await mergeAudioChunks(processedChunkFiles, outputFilePath);

    // Send the processed file to the client
    res.download(outputFilePath);
  } catch (err) {
    console.error("Error processing audio:", err);
    res.status(500).send("Error processing audio");
  } finally {
    // Clean up directories after file is sent
    await deleteDirectory(CHUNK_DIR);
    await deleteDirectory(PROCESSED_DIR);
  }
}

/**
 * Splits an audio file into smaller chunks of a 5 sec duration.
 *
 * @param {string} filePath - The path to the input audio file.
 * @returns {Promise<string[]>} - A promise that resolves with the list of chunk file paths.
 */
function splitAudioFile(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunkDuration = 5; // seconds
    const chunkFiles: string[] = []; // Array to store the paths of the chunk files

    ffmpeg(filePath)
      .outputOptions("-f segment") // Set output format to 'segment' to split the file
      .outputOptions(`-segment_time ${chunkDuration}`) // Set the duration of each chunk
      .outputOptions("-reset_timestamps 1") // Reset timestamps for each segment
      .output(`${CHUNK_DIR}chunk_%04d.mp3`) // Specify the output pattern for chunk files
      .on("end", () => {
        // Read the chunk directory to get the list of chunk files
        fs.readdir(CHUNK_DIR, (err, files) => {
          if (err) return reject(err);

          // Iterate over each file in the directory
          files.forEach((file) => {
            chunkFiles.push(path.join(CHUNK_DIR, file)); // Add the chunk file path to the array
          });
          resolve(chunkFiles); // Resolve the promise with the list of chunk files
        });
      })
      .on("error", (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Modifies the speed and pitch of an audio file.
 *
 * @param {string} inputPath - The path to the input audio file.
 * @param {string} speed - The speed factor to apply to the audio.
 * @param {string} pitch - The pitch adjustment to apply to the audio (in semitones).
 * @returns {Promise<string>} - A promise that resolves with the path to the processed audio file.
 */
function modifyAudio(inputPath: string, speed: string, pitch: string): Promise<string> {
  const outputPath = inputPath.replace(CHUNK_DIR, `${PROCESSED_DIR}processed_`);
  const parsedPitch = parseFloat(pitch);
  const speedPitchAdjustment = 1 / Math.pow(2, parsedPitch / 12);
  const parsedSpeed = parseFloat(speed);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFilters([
        // Apply speed adjustment
        `atempo=${parsedSpeed}`,
        // Apply pitch adjustment
        `asetrate=48000*${Math.pow(2, parsedPitch / 12)}`,
        // Readjust speed back to original
        `atempo=${speedPitchAdjustment}`,
      ])
      .output(outputPath)
      .on("end", () => {
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(err);
      })
      .run();
  });
}

/**
 * Merges multiple audio chunk files into a single audio file.
 *
 * @param {string[]} chunkFiles - Array of paths to the audio chunk files.
 * @param {string} outputPath - The path to the output merged audio file.
 * @returns {Promise<void>} - A promise that resolves when the merging is complete.
 */
function mergeAudioChunks(chunkFiles: string[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Path to file with list of processed chunk paths
    const filelistPath = path.join(CHUNK_DIR, "filelist.txt");
    // Create a formatted string of all files to merge in the filelist
    const filelistContent = chunkFiles.map((file) => `file '${path.resolve(file)}'`).join("\n");

    // Write contents of all files in filelist.txt to a single file
    fs.writeFile(filelistPath, filelistContent, (err) => {
      if (err) return reject(err);

      ffmpeg()
        .input(filelistPath)
        .inputOptions("-f concat") // Set the input format to 'concat' to concatenate files
        .inputOptions("-safe 0") // Allow unsafe file paths
        .outputOptions("-c copy") // Copy the codec (no re-encoding)
        .output(outputPath)
        .on("end", () => {
          resolve();
        })
        .on("error", (err) => {
          console.log("Error merging audio chunks:", err);
          reject(err);
        })
        .run();
    });
  });
}

// Utility function to delete a directory and its contents
function deleteDirectory(dirPath: string) {
  return new Promise<void>((resolve, reject) => {
    fs.rm(dirPath, { recursive: true }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

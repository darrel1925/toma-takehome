import pkg from "wavefile";
const { WaveFile } = pkg;

class WaveFileService {
  bufferTo8kHzMulaw(chunk: Buffer) {
    if (!this.hasWavHeader(chunk)) {
      return chunk;
    }

    // Extract the WAV header and audio
    const { header, audioData } = this.extractAndRemoveWavHeader(chunk);

    // Extract details from the header
    const { numChannels, sampleRate, bitDepth, samples } = this.extractWavDetails(chunk);

    // Create a new WAV file from scratch
    const wav = this.createWavFile(numChannels, sampleRate, bitDepth, samples);

    // Resample to 8kHz
    wav.toSampleRate(8000);

    // Convert the WAV file to mu-Law format
    wav.toMuLaw();

    // Convert the WAV file to a Buffer to send to Deepgram
    let wavBuffer = wav.toBuffer();

    // Add the header back to the wavBuffer
    let fullBuffer = Buffer.concat([header, wavBuffer]);

    return fullBuffer; // Send optimized audio to Deepgram
  }

  // Check if the buffer contains a WAV header
  hasWavHeader(buffer: Buffer): boolean {
    const riff = buffer.toString("ascii", 0, 4); // "RIFF"
    const wave = buffer.toString("ascii", 8, 12); // "WAVE"
    return riff === "RIFF" && wave === "WAVE";
  }

  // Function to extract details from WAV header
  extractWavDetails(header: Buffer) {
    let wav = new WaveFile();
    wav.fromBuffer(header);
    // @ts-ignore
    const numChannels = wav.fmt.numChannels;
    // @ts-ignore
    const sampleRate = wav.fmt.sampleRate;
    // @ts-ignore
    const samples = wav.data.samples; // Default is de-interleaved
    // @ts-ignore
    const chunkSize = wav.data.chunkSize;
    const bitDepth = wav.bitDepth;

    return { numChannels, sampleRate, bitDepth, samples };
  }

  // Extract and remove the WAV header
  extractAndRemoveWavHeader(buffer: Buffer): {
    header: Buffer;
    audioData: Buffer;
  } {
    const headerSize = 44;
    if (buffer.length > headerSize) {
      const header = buffer.subarray(0, headerSize); // Extract the header
      const audioData = Buffer.from(buffer.subarray(headerSize)); // Extract the audio data
      return { header: Buffer.from(header), audioData: audioData };
    }
    return { header: Buffer.alloc(0), audioData: buffer }; // Return an empty buffer for header if too short
  }

  // Function to create a WAV file from scratch
  createWavFile(
    numChannels: number,
    sampleRate: number,
    bitDepth: string,
    samples: number[] | number[][]
  ): pkg.WaveFile {
    let wav = new WaveFile();
    wav.fromScratch(numChannels, sampleRate, bitDepth, samples);
    return wav;
  }

  // Function to convert a WAV file to mu-Law format
  convertToMuLaw(wav: pkg.WaveFile): pkg.WaveFile {
    wav.toMuLaw();
    return wav;
  }
}


const waveFileService = new WaveFileService();
export default waveFileService;

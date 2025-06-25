import { promises as fs } from 'node:fs';
import ffmpeg from 'fluent-ffmpeg';

// Function to convert an audio file from OGG to MP3
export async function convertAudio(inputFilePath: string, outputFilePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      .audioCodec('libmp3lame')
      .output(outputFilePath)
      .on('end', () => {
        console.log('Audio conversion complete!');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error during audio conversion:', err);
        reject(err);
      })
      .run();
  });
}
/** Supabase bucket `courseflow-assets` 目前允許的音訊 MIME（與 migration 同步） */
export const STORAGE_ALLOWED_AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
]);

export function normalizeAudioMimeType(input: string): string {
  return input.split(";")[0]?.trim().toLowerCase() || "";
}

export function isStorageAllowedAudioMime(mime: string): boolean {
  const normalized = normalizeAudioMimeType(mime);
  return normalized !== "" && STORAGE_ALLOWED_AUDIO_MIMES.has(normalized);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const sampleCount = buffer.length;
  const dataSize = sampleCount * blockAlign;

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < sampleCount; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch]?.[i] ?? 0));
      const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const context = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close();
  }
}

export async function ensureStorageCompatibleAudioFile(
  source: Blob,
  baseName: string,
): Promise<File> {
  const mime = normalizeAudioMimeType(source.type);
  if (isStorageAllowedAudioMime(mime)) {
    const ext = mime.includes("wav") ? "wav" : "mp3";
    return new File([source], `${baseName}.${ext}`, { type: mime });
  }

  const decoded = await decodeAudioBlob(source);
  const wavBlob = encodeWavFromAudioBuffer(decoded);
  return new File([wavBlob], `${baseName}.wav`, { type: "audio/wav" });
}

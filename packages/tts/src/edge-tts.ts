import { EdgeTTS } from "edge-tts-universal";
import type { TtsCredentials, TtsProvider, TtsVoice } from "./types.js";
import { EDGE_TTS_ZH_TW_VOICES } from "./types.js";

export const edgeTtsProvider: TtsProvider = {
  id: "edge-tts",
  requiresApiKey: false,

  async listVoices(): Promise<TtsVoice[]> {
    return [...EDGE_TTS_ZH_TW_VOICES];
  },

  async synthesize(text: string, voiceId: string): Promise<Buffer> {
    const EDGE_TTS_TIMEOUT_MS = 120_000;
    const work = (async () => {
      const tts = new EdgeTTS(text, voiceId);
      const result = await tts.synthesize();
      const arrayBuffer = await result.audio.arrayBuffer();
      return Buffer.from(arrayBuffer);
    })();
    const timeout = new Promise<Buffer>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Edge-TTS 逾時（>${EDGE_TTS_TIMEOUT_MS / 1000} 秒），請稍後重試`)),
        EDGE_TTS_TIMEOUT_MS,
      );
    });
    return Promise.race([work, timeout]);
  },
};

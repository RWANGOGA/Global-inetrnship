"use client";

interface DeepLConfig {
  apiKey: string;
  baseUrl: string;
}

interface VoiceOptions {
  lang?: string;
  voice?: string;
  speed?: number;
}

const DEFAULT_CONFIG: DeepLConfig = {
  apiKey: process.env.NEXT_PUBLIC_DEEPL_API_KEY || "",
  baseUrl: "https://api-free.deepl.com/v2",
};

class VoiceService {
  private config: DeepLConfig;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private isRecording = false;

  constructor(config: Partial<DeepLConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setApiKey(apiKey: string) {
    this.config.apiKey = apiKey;
  }

  async textToSpeech(text: string, options: VoiceOptions = {}): Promise<HTMLAudioElement | null> {
    if (!this.config.apiKey) {
      console.warn("DeepL API key not configured. Using browser speech synthesis as fallback.");
      return this.fallbackTTS(text, options);
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/tts`, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          target_lang: options.lang || "EN-US",
          voice: options.voice || "default",
          speed: options.speed || 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepL TTS error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      return audio;
    } catch (error) {
      console.error("DeepL TTS failed, falling back to browser TTS:", error);
      return this.fallbackTTS(text, options);
    }
  }

  private fallbackTTS(text: string, options: VoiceOptions): HTMLAudioElement {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || "en-US";
    utterance.rate = options.speed || 1.0;
    
    const audio = new Audio();
    audio.srcObject = new MediaStream();
    
    const mediaRecorder = new MediaRecorder(audio.srcObject);
    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/wav" });
      audio.src = URL.createObjectURL(blob);
    };
    
    mediaRecorder.start();
    speechSynthesis.speak(utterance);
    
    utterance.onend = () => mediaRecorder.stop();
    
    return audio;
  }

  async speechToText(audioBlob: Blob, options: VoiceOptions = {}): Promise<string> {
    if (!this.config.apiKey) {
      console.warn("DeepL API key not configured. STT not available without API key.");
      throw new Error("DeepL API key required for speech-to-text");
    }

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");
      formData.append("target_lang", options.lang || "EN-US");

      const response = await fetch(`${this.config.baseUrl}/stt`, {
        method: "POST",
        headers: {
          "Authorization": `DeepL-Auth-Key ${this.config.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`DeepL STT error: ${response.status}`);
      }

      const data = await response.json();
      return data.text || "";
    } catch (error) {
      console.error("DeepL STT failed:", error);
      throw error;
    }
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw new Error("Microphone access denied or not available");
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error("Not recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: "audio/webm" });
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
      
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      this.isRecording = false;
      this.mediaRecorder = null;
      this.audioChunks = [];
    }
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }

  async playAudio(audio: HTMLAudioElement): Promise<void> {
    return new Promise((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error("Audio playback failed"));
      audio.play().catch(reject);
    });
  }

  stopAudio(audio: HTMLAudioElement): void {
    audio.pause();
    audio.currentTime = 0;
  }
}

export const voiceService = new VoiceService();
export type { VoiceOptions, DeepLConfig };
/**
 * Plant Doctor AI — Farmer Assistant & Voice Client
 * Handles communication with backend Group API + Gemini Fallback and multi-tier STT/TTS.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
  audio?: string | null;
  navigate?: string | null;
  image?: string | null;
}

export interface AssistantRequestPayload {
  message: string;
  conversation_id?: string;
  history?: Array<{ role: string; content: string }>;
  language?: string;
  voice_mode?: boolean;
  crop?: string;
  location?: string;
  context?: Record<string, any>;
}

export interface AssistantResponsePayload {
  success: boolean;
  answer: string;
  response: string;
  language: string;
  source: 'primary' | 'fallback' | 'degraded';
  confidence: number;
  suggestions: string[];
  audio?: string | null;
  voice_url?: string | null;
  navigate?: string | null;
  latency_sec?: number;
  conversation_id?: string;
}

export async function askFarmerAssistant(
  payload: AssistantRequestPayload
): Promise<AssistantResponsePayload> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data: AssistantResponsePayload = await res.json();
    return data;
  } catch (err) {
    console.warn('Backend assistant request error, falling back locally:', err);
    // Graceful offline fallback
    return {
      success: true,
      answer:
        payload.language === 'ਪੰਜਾਬੀ'
          ? 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਲਈ ਹਾਜ਼ਰ ਹਾਂ। ਪੌਦੇ ਦੀ ਫੋਟੋ ਭੇਜੋ ਜਾਂ ਆਪਣਾ ਸਵਾਲ ਪੁੱਛੋ।'
          : 'नमस्ते किसान जी! मैं आपकी मदद के लिए यहाँ हूँ। पौधे की फोटो भेजें या अपनी समस्या बताएं।',
      response: 'नमस्ते किसान जी!',
      language: payload.language || 'Hindi',
      source: 'degraded',
      confidence: 0.85,
      suggestions: ['📷 पौधे की फोटो भेजें', '🌾 खाद की सही मात्रा', '🌤️ आज का मौसम'],
      conversation_id: payload.conversation_id,
    };
  }
}

export async function resetConversationSession(
  conversationId: string,
  language: string = 'Hindi'
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/ai/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, language }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Reset conversation error:', err);
    return false;
  }
}

export async function transcribeAudioBlob(
  audioBlob: Blob,
  language: string = 'Hindi'
): Promise<{ text: string; language: string; confidence: number }> {
  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    formData.append('language', language);

    const res = await fetch(`${API_BASE}/api/v1/voice/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`STT failed: ${res.status}`);
    const data = await res.json();
    return {
      text: data.text || '',
      language: data.language || 'hi',
      confidence: data.confidence || 0.9,
    };
  } catch (err) {
    console.warn('Remote STT error:', err);
    return { text: '', language: 'hi', confidence: 0 };
  }
}

export async function synthesizeSpeech(
  text: string,
  language: string = 'Hindi'
): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/voice/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.audio_base64) {
      return `data:audio/${data.format || 'mp3'};base64,${data.audio_base64}`;
    }
    return null;
  } catch (err) {
    console.warn('Remote TTS error:', err);
    return null;
  }
}

export async function analyzeLeafImage(
  imageBlob: Blob,
  question: string,
  crop: string = '',
  language: string = 'Hindi',
  conversationId?: string
): Promise<AssistantResponsePayload> {
  try {
    const formData = new FormData();
    formData.append('image', imageBlob, 'leaf.jpg');
    formData.append('question', question);
    formData.append('crop', crop);
    formData.append('language', language);
    if (conversationId) {
      formData.append('conversation_id', conversationId);
    }

    const res = await fetch(`${API_BASE}/api/v1/ai/analyze-leaf`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      success: true,
      answer: 'नमस्ते जी! फोटो प्राप्त हो गई है। सटीक रोग निदान के लिए हमारे AI Scanner में जांच करें।',
      response: 'नमस्ते जी! फोटो प्राप्त हो गई है।',
      language,
      source: 'degraded',
      confidence: 0.85,
      suggestions: ['🔍 AI Scanner खोलें', '🌱 खाद सलाह', '📞 विशेषज्ञ कॉल'],
      navigate: '/scanner',
      conversation_id: conversationId,
    };
  }
}

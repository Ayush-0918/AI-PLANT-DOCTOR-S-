import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT: Record<string, string> = {
  English: `You are an expert AI agricultural assistant called "Plant Doctor AI" for Indian farmers. 
Answer questions about: crop diseases, fertilizers, pesticides, weather impact on crops, market prices, farming techniques, and irrigation.
Keep answers SHORT (2-4 sentences max), practical, and specific to Indian agriculture.
If asked to navigate/open a page like "open scan" or "open shop", respond with: NAVIGATE:/scanner or NAVIGATE:/marketplace or NAVIGATE:/community etc.
Always be helpful, warm, and farmer-friendly.`,

  'हिंदी': `आप "Plant Doctor AI" नाम के भारतीय किसानों के लिए एक विशेषज्ञ AI कृषि सहायक हैं।
फसल रोग, खाद, कीटनाशक, मौसम प्रभाव, मंडी भाव, खेती तकनीक और सिंचाई के बारे में सवालों का जवाब दें।
जवाब छोटे (2-4 वाक्य), व्यावहारिक और भारतीय खेती के लिए उपयुक्त रखें।
अगर कोई "स्कैन खोलो" या "दुकान खोलो" जैसा कहे तो जवाब दें: NAVIGATE:/scanner या NAVIGATE:/marketplace
हमेशा मददगार और किसान-मित्रवत रहें। हिंदी में जवाब दें।`,

  'भोजपुरी': `रउआ "Plant Doctor AI" नाम के भारतीय किसान लोगन के खातिर एक विशेषज्ञ AI कृषि सहायक बानीं।
फसल रोग, खाद, कीड़ा मार दवा, मौसम, मंडी भाव, खेती तरीका के बारे में जवाब दीं।
जवाब छोट (2-4 वाक्य) आउर व्यावहारिक रखीं।
अगर "स्कैन खोलीं" या "बाजार खोलीं" कहे तो: NAVIGATE:/scanner या NAVIGATE:/marketplace बोलीं।
हमेशा मददगार रहीं। भोजपुरी में जवाब दीं।`,

  'ਪੰਜਾਬੀ': `ਤੁਸੀਂ "Plant Doctor AI" ਨਾਮ ਦੇ ਭਾਰਤੀ ਕਿਸਾਨਾਂ ਲਈ ਇੱਕ ਮਾਹਰ AI ਖੇਤੀ ਸਹਾਇਕ ਹੋ।
ਫ਼ਸਲ ਰੋਗ, ਖਾਦ, ਕੀਟਨਾਸ਼ਕ, ਮੌਸਮ, ਮੰਡੀ ਭਾਅ ਅਤੇ ਖੇਤੀ ਤਕਨੀਕਾਂ ਬਾਰੇ ਜਵਾਬ ਦਿਓ।
ਜਵਾਬ ਛੋਟੇ (2-4 ਵਾਕ) ਅਤੇ ਵਿਹਾਰਕ ਰੱਖੋ।
ਜੇ "ਸਕੈਨ ਖੋਲੋ" ਕਹੇ ਤਾਂ: NAVIGATE:/scanner ਕਹੋ।
ਹਮੇਸ਼ਾ ਮਦਦਗਾਰ ਰਹੋ। ਪੰਜਾਬੀ ਵਿੱਚ ਜਵਾਬ ਦਿਓ।`,
};

const NAV_FALLBACK: Record<string, Record<string, string>> = {
  English: { scan: '/scanner', scanner: '/scanner', shop: '/marketplace', market: '/marketplace', community: '/community', profile: '/profile', home: '/dashboard', soil: '/soil' },
  'हिंदी': { स्कैन: '/scanner', दुकान: '/marketplace', बाज़ार: '/marketplace', समुदाय: '/community', घर: '/dashboard', मिट्टी: '/soil' },
  'भोजपुरी': { स्कैन: '/scanner', बाजार: '/marketplace', घर: '/dashboard' },
  'ਪੰਜਾਬੀ': { ਸਕੈਨ: '/scanner', ਦੁਕਾਨ: '/marketplace', ਘਰ: '/dashboard' },
};

function checkNavIntent(text: string, lang: string): string | null {
  const lower = text.toLowerCase();
  const navMap = { ...NAV_FALLBACK['English'], ...(NAV_FALLBACK[lang] || {}) };
  for (const [key, route] of Object.entries(navMap)) {
    if (lower.includes(key.toLowerCase())) return route;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { query, language, crop, location } = await req.json();

    // 1. Try Backend Group API + Gemini Fallback orchestrator first
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          language: language || 'Hindi',
          crop,
          location,
          voice_mode: false,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (backendRes.ok) {
        const backendData = await backendRes.json();
        return NextResponse.json({
          text: backendData.answer || backendData.response || '',
          navigate: backendData.navigate || null,
          source: backendData.source || 'group_api',
          suggestions: backendData.suggestions || [],
        });
      }
    } catch (e) {
      console.warn('Backend proxy failed, trying edge Gemini fallback:', e);
    }

    // 2. Direct Gemini Fallback if backend is unreachable
    const apiKey = process.env.GEMINI_API_KEY;
    const navRoute = checkNavIntent(query, language);

    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      const systemPrompt = SYSTEM_PROMPT[language] || SYSTEM_PROMPT['English'];
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nFarmer says: "${query}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 250,
          topP: 0.85,
        },
      };

      const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const navMatch = text.match(/NAVIGATE:(\/\w+)/);
        if (navMatch) {
          return NextResponse.json({ navigate: navMatch[1], text: '' });
        }
        if (navRoute) {
          return NextResponse.json({ navigate: navRoute, text: '' });
        }
        return NextResponse.json({ text: text.trim(), source: 'gemini_fallback' });
      }
    }

    // 3. Fallback to clean local response
    return NextResponse.json({
      text:
        language === 'ਪੰਜਾਬੀ'
          ? 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਕਿਸਾਨ ਜੀ! ਪੌਦੇ ਦੀ ਫੋਟੋ ਭੇਜੋ ਜਾਂ ਆਪਣਾ ਸਵਾਲ ਪੁੱਛੋ।'
          : 'नमस्ते किसान जी! आप पौधे के पत्ते की एक साफ फोटो भेज दीजिए या अपना सवाल पूछें।',
      navigate: navRoute,
      source: 'local_knowledge',
    });
  } catch (err) {
    console.error('AI assistant error:', err);
    return NextResponse.json({
      text: 'नमस्ते किसान जी! मैं आपकी सहायता के लिए यहाँ हूँ। कृपया अपना सवाल पूछें।',
      source: 'offline_fallback',
    });
  }
}

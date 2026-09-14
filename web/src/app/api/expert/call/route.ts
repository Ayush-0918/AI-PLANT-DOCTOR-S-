/**
 * Next.js API proxy: /api/expert/call
 * Proxies the VAPI outbound-call request to the FastAPI backend.
 * Falls back to a direct VAPI call if the backend is unreachable.
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const VAPI_URL    = 'https://api.vapi.ai/call';

const VAPI_API_KEY         = process.env.VAPI_API_KEY         || '';
const VAPI_ASSISTANT_ID    = process.env.VAPI_ASSISTANT_ID    || '';
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || '';

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPhone: string = body.phone_number || body.phoneNumber || '';

    if (!rawPhone) {
      return NextResponse.json({ success: false, message: 'Phone number required.' }, { status: 400 });
    }

    // 1. Proxy to FastAPI backend first
    try {
      const backendRes = await fetch(`${BACKEND_URL}/api/v1/expert/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: rawPhone, reason: 'app_initiated' }),
        signal: AbortSignal.timeout(12_000),
      });

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data);
      }

      const errData = await backendRes.json().catch(() => ({}));
      const errMsg  = errData?.detail || errData?.message || `Backend error ${backendRes.status}`;
      if (backendRes.status !== 503) {
        return NextResponse.json({ success: false, message: errMsg }, { status: backendRes.status });
      }
    } catch {
      // Backend down — fall through
    }

    // 2. Direct VAPI or Direct Twilio fallback
    const TWILIO_ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID || '';
    const TWILIO_AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN  || '';
    const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER|| '';

    const phoneE164 = normalizePhone(rawPhone);

    if (VAPI_API_KEY && VAPI_ASSISTANT_ID && VAPI_PHONE_NUMBER_ID) {
      const vapiRes = await fetch(VAPI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${VAPI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: VAPI_ASSISTANT_ID, phoneNumberId: VAPI_PHONE_NUMBER_ID, customer: { number: phoneE164 } }),
        signal: AbortSignal.timeout(12_000),
      });

      const vapiData = await vapiRes.json().catch(() => ({}));
      if (vapiRes.ok) {
        return NextResponse.json({ success: true, call_id: vapiData.id || '', status: 'initiated', message: 'Expert call (VAPI) initiated.' });
      }
      return NextResponse.json({ success: false, message: vapiData?.message || `VAPI error ${vapiRes.status}` }, { status: vapiRes.status });
    }

    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
      const twimlScript = `<Response><Say voice='alice' language='hi-IN'>Namaste ji! Main aapka AI Plant Doctor hoon. Aap tension na lein, aapki kheti aur paudhon ki har samasya me main aapki sahayata karunga.</Say></Response>`;
      
      const formData = new URLSearchParams();
      formData.append('To', phoneE164);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Twiml', twimlScript);

      const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const twilioRes = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(12_000),
      });

      const twilioData = await twilioRes.json().catch(() => ({}));
      if (twilioRes.ok) {
        return NextResponse.json({ success: true, call_id: twilioData.sid || '', status: 'initiated', message: `AI Doctor call initiated to ${phoneE164} via Twilio.` });
      }

      return NextResponse.json({ success: false, message: twilioData?.message || `Twilio error ${twilioRes.status}` }, { status: twilioRes.status });
    }

    return NextResponse.json(
      { success: false, message: 'Neither VAPI nor Twilio credentials are configured.' },
      { status: 503 },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error.' }, { status: 500 });
  }
}

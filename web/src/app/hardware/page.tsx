'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Thermometer, Droplets, Activity, Usb, Zap,
  CheckCircle2, AlertTriangle, Terminal, Code2,
  Sprout, ArrowLeft, Square, ShieldCheck, Copy, Check, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

const ARDUINO_SOURCE_CODE = `#include <DHT.h>

#define DHTPIN 2     
#define DHTTYPE DHT11   
DHT dht(DHTPIN, DHTTYPE);

const int sensorPin = A0; 
const int powerPin = 7;    

const int dryValue = 950;  // Open air (0%)
const int wetValue = 300;  // Fully submerged (100%)

void setup() {
  Serial.begin(9600);
  pinMode(powerPin, OUTPUT); 
  digitalWrite(powerPin, LOW); 
  dht.begin();
  Serial.println("--- DHT11 & Soil Moisture Monitor Initialized ---");
}

void loop() {
  digitalWrite(powerPin, HIGH); 
  delay(15); 
  int rawValue = analogRead(sensorPin); 
  digitalWrite(powerPin, LOW);  

  int moisturePercent = map(rawValue, dryValue, wetValue, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);

  String soilStatus;
  if (moisturePercent <= 30) soilStatus = "DRY (Needs Water!)";
  else if (moisturePercent <= 70) soilStatus = "MOIST (Ideal/Intermediate)";
  else soilStatus = "WET (Fully Saturated)";

  float h = dht.readHumidity();
  float t = dht.readTemperature();

  Serial.println("==================================================");
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 Error: Failed to read air temp/humidity!");
  } else {
    Serial.print("Air Temp: "); Serial.print(t); Serial.print(" C | ");
    Serial.print("Air Humidity: "); Serial.print(h); Serial.println("%");
  }
  Serial.print("Soil Raw: "); Serial.print(rawValue); Serial.print(" | ");
  Serial.print("Soil Moisture: "); Serial.print(moisturePercent); Serial.println("%");
  Serial.print("Soil Status: "); Serial.println(soilStatus);
  Serial.println("==================================================");

  delay(2000); 
}`;

interface SensorReading {
  airTemp: number;
  airHumidity: number;
  soilRaw: number;
  soilMoisture: number;
  soilStatus: string;
  timestamp: string;
}

export default function HardwarePage() {
  const { language } = useLanguage();
  const isHi = language === 'hi';

  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('DISCONNECTED');
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'console' | 'code'>('console');
  const [copiedCode, setCopiedCode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const [sensorData, setSensorData] = useState<SensorReading>({
    airTemp: 26.5,
    airHumidity: 58.0,
    soilRaw: 512,
    soilMoisture: 65,
    soilStatus: 'MOIST (Ideal/Intermediate)',
    timestamp: '--:--:--',
  });

  const terminalRef = useRef<HTMLDivElement>(null);
  const serialPortRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const isReadingRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    setSensorData((prev) => ({
      ...prev,
      timestamp: new Date().toLocaleTimeString(),
    }));
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev.slice(-80), `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  const parseArduinoOutput = useCallback((line: string) => {
    try {
      const tempMatch = line.match(/Air Temp:\s*([\d.]+)/i);
      const humidityMatch = line.match(/Air Humidity:\s*([\d.]+)\s*%/i);
      const rawMatch = line.match(/Soil Raw:\s*(\d+)/i);
      const moistureMatch = line.match(/Soil Moisture:\s*(\d+)%/i);
      const statusMatch = line.match(/Soil Status:\s*([^\n\r]+)/i);

      setSensorData((prev) => {
        const updated = { ...prev, timestamp: new Date().toLocaleTimeString() };
        if (tempMatch?.[1]) updated.airTemp = parseFloat(tempMatch[1]);
        if (humidityMatch?.[1]) updated.airHumidity = parseFloat(humidityMatch[1]);
        if (rawMatch?.[1]) updated.soilRaw = parseInt(rawMatch[1], 10);
        if (moistureMatch?.[1]) updated.soilMoisture = parseInt(moistureMatch[1], 10);
        if (statusMatch?.[1]) updated.soilStatus = statusMatch[1].trim();
        return updated;
      });
    } catch { /* silently ignore parse errors */ }
  }, []);

  // ── SAFE NON-BLOCKING READ LOOP ──
  const startReadLoop = useCallback((port: any) => {
    const decoder = new TextDecoder();
    let buffer = '';
    isReadingRef.current = true;

    const loop = async () => {
      try {
        const reader = port.readable?.getReader();
        if (!reader) return;
        readerRef.current = reader;

        while (isReadingRef.current) {
          let result: any;
          try {
            result = await reader.read();
          } catch {
            break;
          }
          if (result.done) break;
          if (result.value) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed) {
                addLog(trimmed);
                parseArduinoOutput(trimmed);
              }
            }
          }
        }
        // Release the lock before closing
        try { reader.cancel(); } catch {}
      } catch (err: any) {
        const msg = err?.message ?? '';
        if (msg && err?.name !== 'AbortError') {
          addLog(`ℹ️ Stream closed: ${msg}`);
        }
      } finally {
        isReadingRef.current = false;
        readerRef.current = null;
        setIsConnected(false);
        setConnectionStatus('DISCONNECTED');
      }
    };

    // void the promise so Next.js doesn't catch it as an unhandled rejection
    void loop();
  }, [addLog, parseArduinoOutput]);

  // ── CONNECT ──
  const connectWebSerial = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serial' in navigator)) {
      alert(
        isHi
          ? 'आपके ब्राउज़र में Web Serial API सपोर्ट नहीं है। कृपया Chrome या Edge का उपयोग करें।'
          : 'Web Serial API not supported. Please use Google Chrome or Microsoft Edge.'
      );
      return;
    }
    try {
      setConnectionStatus('CONNECTING...');
      addLog('Requesting USB Serial Port (9600 Baud)...');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 9600 });
      serialPortRef.current = port;
      setIsConnected(true);
      setIsSimulating(false);
      setConnectionStatus('ONLINE (USB 9600)');
      addLog('✅ Connected to Arduino! Streaming live telemetry...');
      startReadLoop(port);
    } catch (err: any) {
      const name = err?.name ?? '';
      const msg  = err?.message ?? '';
      if (name === 'NotFoundError') {
        addLog('ℹ️ Port selection cancelled.');
      } else if (msg) {
        addLog(`⚠️ ${msg}`);
      }
      setConnectionStatus('DISCONNECTED');
      setIsConnected(false);
    }
  }, [isHi, addLog, startReadLoop]);

  // ── DISCONNECT ──
  const disconnectWebSerial = useCallback(async () => {
    isReadingRef.current = false;
    try { readerRef.current?.cancel(); } catch {}
    await new Promise((r) => setTimeout(r, 120));
    try { await serialPortRef.current?.close(); } catch {}
    readerRef.current = null;
    serialPortRef.current = null;
    setIsConnected(false);
    setConnectionStatus('DISCONNECTED');
    addLog('🔌 Disconnected from USB Serial.');
  }, [addLog]);

  // ── DEMO SIMULATION MODE ──
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isSimulating) {
      addLog('▶️ Demo Simulation Mode Started');
      interval = setInterval(() => {
        const simRaw = Math.floor(400 + Math.random() * 300);
        let simMoisture = Math.round(((950 - simRaw) / (950 - 300)) * 100);
        simMoisture = Math.max(0, Math.min(100, simMoisture));

        let simStatus = 'MOIST (Ideal/Intermediate)';
        if (simMoisture <= 30) simStatus = 'DRY (Needs Water!)';
        else if (simMoisture > 70) simStatus = 'WET (Fully Saturated)';

        const simTemp = parseFloat((24 + Math.random() * 8).toFixed(2));
        const simHumidity = parseFloat((48 + Math.random() * 25).toFixed(2));

        // Log all three lines so parseArduinoOutput can pick them all up
        addLog(`Air Temp: ${simTemp} C | Air Humidity: ${simHumidity}%`);
        addLog(`Soil Raw: ${simRaw} | Soil Moisture: ${simMoisture}%`);
        addLog(`Soil Status: ${simStatus}`);

        setSensorData({
          airTemp: simTemp,
          airHumidity: simHumidity,
          soilRaw: simRaw,
          soilMoisture: simMoisture,
          soilStatus: simStatus,
          timestamp: new Date().toLocaleTimeString(),
        });
      }, 2500);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isSimulating, addLog]);

  // Soil Status Color Theme (Soft Pastel Palette)
  const getSoilStatusTheme = (moisture: number) => {
    if (moisture <= 30) {
      return {
        label: isHi ? 'सूखी मिट्टी — तुरंत सिंचाई करें' : 'DRY — Needs Immediate Irrigation',
        cardBg: 'from-rose-50/90 via-amber-50/40 to-white',
        border: 'border-rose-200',
        badgeBg: 'bg-rose-100/90 text-rose-900 border-rose-300',
        progressBg: 'bg-rose-500',
        advice: isHi ? 'मिट्टी अत्यधिक सूखी है। तुरंत 15-20 लीटर/वर्ग मीटर सिंचाई करें।' : 'Soil moisture is critically low. Apply irrigation immediately.',
      };
    } else if (moisture <= 70) {
      return {
        label: isHi ? 'नमी युक्त — आदर्श व संतुलित स्तर' : 'MOIST — Ideal Balanced Condition',
        cardBg: 'from-emerald-50/90 via-teal-50/40 to-white',
        border: 'border-emerald-200',
        badgeBg: 'bg-emerald-100/90 text-emerald-900 border-emerald-300',
        progressBg: 'bg-emerald-500',
        advice: isHi ? 'मिट्टी में नमी का स्तर उत्तम है। अगले 24-48 घंटे सिंचाई की आवश्यकता नहीं है।' : 'Soil moisture is optimal (65%). Delay watering for 24-48 hours.',
      };
    } else {
      return {
        label: isHi ? 'अत्यधिक गीली — जलभराव का खतरा' : 'WET — Saturated Soil (Check Drainage)',
        cardBg: 'from-cyan-50/90 via-sky-50/40 to-white',
        border: 'border-cyan-200',
        badgeBg: 'bg-cyan-100/90 text-cyan-900 border-cyan-300',
        progressBg: 'bg-cyan-500',
        advice: isHi ? 'मिट्टी में अत्यधिक पानी है। जल निकासी सुनिश्चित करें।' : 'Soil is saturated. Ensure field drainage to prevent root rot.',
      };
    }
  };

  const statusTheme = getSoilStatusTheme(sensorData.soilMoisture);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/30 text-slate-800 relative overflow-hidden font-sans pb-56">
      
      {/* Soft Ambient Light Glows */}
      <div className="absolute top-10 left-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ── STICKY TOP APP HEADER (MATCHING SOIL GUIDE & SCANNER) ── */}
      <header className="sticky top-0 z-50 px-4 py-3.5 bg-white/90 backdrop-blur-2xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="h-10 w-10 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200/80 hover:scale-105 active:scale-95 transition-all shadow-xs shrink-0"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-emerald-600 animate-pulse" />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                  {isHi ? 'AI IoT टेलीमेट्री' : 'AI IoT Telemetry'}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight whitespace-nowrap">
                {isHi ? 'स्मार्ट फार्म सेंसर' : 'IoT Farm Sensors'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Arduino Uno
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="px-4 py-4 max-w-xl mx-auto space-y-4 relative z-10">

        {/* CONTROLS CARD: CLEAN 2-BUTTON BAR */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            {!isConnected ? (
              <button
                onClick={connectWebSerial}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
              >
                <Usb size={15} />
                <span>{isHi ? 'USB कनेक्ट' : 'Connect USB'}</span>
              </button>
            ) : (
              <button
                onClick={disconnectWebSerial}
                className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <Square size={14} />
                <span>{isHi ? 'डिसकनेक्ट' : 'Disconnect'}</span>
              </button>
            )}

            <button
              onClick={() => setIsSimulating(!isSimulating)}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                isSimulating
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <Activity size={15} className={isSimulating ? 'animate-spin text-amber-600' : 'text-slate-500'} />
              <span>{isSimulating ? (isHi ? 'सिमुलेशन चालू' : 'Simulating') : (isHi ? 'डेमो मोड' : 'Demo Mode')}</span>
            </button>
          </div>

          {/* STATUS LINE */}
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100 text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected || isSimulating ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              <span className="font-semibold text-slate-800">{connectionStatus}</span>
            </div>
            <div className="flex items-center gap-2.5 font-mono">
              <span>9600 Baud</span>
              <span>D2 · A0</span>
              <span className="text-emerald-700 font-bold" suppressHydrationWarning>
                {isMounted ? sensorData.timestamp : '--:--:--'}
              </span>
            </div>
          </div>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="space-y-3.5">
          
          {/* CARD 1: SOIL MOISTURE */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl bg-gradient-to-br ${statusTheme.cardBg} border ${statusTheme.border} shadow-xs space-y-3`}
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Sprout size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {isHi ? 'मिट्टी की नमी' : 'Soil Moisture Probe'}
                  </h3>
                  <p className="text-[10px] text-slate-500">Analog Pin A0</p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                ADC: {sensorData.soilRaw}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                  {sensorData.soilMoisture}%
                </span>
                <span className="text-[11px] font-medium text-slate-500">Volumetric Content</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${statusTheme.progressBg}`}
                  animate={{ width: `${sensorData.soilMoisture}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0% (Dry)</span>
                <span>100% (Wet)</span>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${statusTheme.badgeBg}`}>
              <span className="w-2 h-2 rounded-full bg-current shrink-0" />
              <span>{statusTheme.label}</span>
            </div>
          </motion.div>

          {/* CARD 2: AIR TEMPERATURE */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-rose-50/90 via-amber-50/40 to-white border border-rose-200 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-rose-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200">
                  <Thermometer size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {isHi ? 'हवा का तापमान' : 'Ambient Air Temperature'}
                  </h3>
                  <p className="text-[10px] text-slate-500">DHT11 Digital Pin 2</p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                {((sensorData.airTemp * 9) / 5 + 32).toFixed(1)}°F
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                  {sensorData.airTemp}°C
                </span>
                <span className="text-[11px] font-medium text-slate-500">Ambient Temperature</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                  animate={{ width: `${Math.min(100, Math.max(0, (sensorData.airTemp / 50) * 100))}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0°C</span>
                <span>25°C</span>
                <span>50°C</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-900 border border-rose-200 text-[11px] font-bold flex items-center gap-2">
              <ShieldCheck size={14} className="text-rose-700 shrink-0" />
              <span>
                {sensorData.airTemp > 35
                  ? isHi ? 'उच्च तापमान: हीट स्ट्रेस' : 'High Temp: Crop Heat Stress Risk'
                  : isHi ? 'फसलों के विकास हेतु अनुकूल तापमान' : 'Optimal thermal zone for vegetative growth'}
              </span>
            </div>
          </motion.div>

          {/* CARD 3: AIR HUMIDITY */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-sky-50/90 via-cyan-50/40 to-white border border-sky-200 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-sky-200/60 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-sky-100 text-sky-800 border border-sky-200">
                  <Droplets size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {isHi ? 'हवा की आर्द्रता' : 'Relative Air Humidity'}
                  </h3>
                  <p className="text-[10px] text-slate-500">DHT11 RH %</p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                RH %
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-900 tracking-tight leading-none">
                  {sensorData.airHumidity}%
                </span>
                <span className="text-[11px] font-medium text-slate-500">Relative Humidity</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-sky-500"
                  animate={{ width: `${sensorData.airHumidity}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>0% RH</span>
                <span>100% RH</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-950 border border-sky-200 text-[11px] font-bold flex items-center gap-2">
              {sensorData.airHumidity > 75 ? (
                <>
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <span className="text-amber-900">
                    {isHi ? 'उच्च आर्द्रता: फफूंद का खतरा' : 'High humidity: fungal leaf risk'}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
                  <span>
                    {isHi ? 'आर्द्रता सुरक्षित व सामान्य है' : 'Safe humidity level — low fungal risk'}
                  </span>
                </>
              )}
            </div>
          </motion.div>

        </div>

        {/* AI ADVISORY CARD */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-100/90 via-teal-50/90 to-white border border-emerald-300 shadow-xs space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
              <Zap size={16} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-extrabold text-emerald-950">
                  {isHi ? 'लाइव AI सिंचाई सलाह' : 'Live AI Soil Advisory'}
                </h4>
                <span className="px-1.5 py-0.5 text-[9px] font-bold font-mono bg-emerald-200 text-emerald-900 rounded">
                  LIVE AI
                </span>
              </div>
              <p className="text-[11px] text-emerald-900 mt-0.5 leading-snug font-medium">
                {statusTheme.advice}
              </p>
            </div>
          </div>

          <Link
            href="/soil"
            className="w-full py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center transition-all shadow-2xs"
          >
            {isHi ? 'सम्पूर्ण सॉइल विश्लेषण देखें' : 'View Full Soil Guide'}
          </Link>
        </div>

        {/* TELEMETRY TERMINAL & ARDUINO CODE TABS */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('console')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'console'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                <Terminal size={12} />
                <span>{isHi ? 'सीरियल लॉग' : 'Telemetry'}</span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'code'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                <Code2 size={12} />
                <span>{isHi ? 'Arduino कोड' : 'Code'}</span>
              </button>
            </div>

            <div>
              {activeTab === 'console' && (
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200"
                >
                  Clear
                </button>
              )}
              {activeTab === 'code' && (
                <button
                  onClick={async () => {
                    try {
                      if (navigator?.clipboard) {
                        await navigator.clipboard.writeText(ARDUINO_SOURCE_CODE);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }
                    } catch {}
                  }}
                  className="text-[11px] font-bold text-emerald-800 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 flex items-center gap-1"
                >
                  {copiedCode ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === 'console' && (
            <div
              ref={terminalRef}
              className="p-3.5 font-mono text-[11px] text-emerald-400 bg-slate-950 h-36 overflow-y-auto space-y-1"
            >
              {logs.length === 0 ? (
                <p className="text-slate-500 italic text-[10px]">
                  Awaiting serial data... Click "Connect USB" or "Demo Mode".
                </p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="hover:bg-slate-900 px-1 py-0.2 rounded text-[10px] leading-tight">
                    {log}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="p-3 font-mono text-[10px] text-slate-800 bg-slate-50 h-36 overflow-y-auto leading-relaxed border-t border-slate-100">
              <pre>{ARDUINO_SOURCE_CODE}</pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

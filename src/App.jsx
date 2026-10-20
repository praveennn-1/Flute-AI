import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Zap,
  Volume2,
  Copy,
  Check,
  RotateCcw,
  Sliders,
  ShieldCheck,
  ChevronDown,
  Globe,
  MessageSquare,
  FileText,
  Code2,
  Terminal,
  Layers,
  Wand2,
  VolumeX,
  Settings2
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Dictionary of proper technical nouns & acronyms (inspired by Wispr Flow's dictionary system)
const JARGON_MAP = {
  'fastapi': 'FastAPI',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'sqlite': 'SQLite',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'github': 'GitHub',
  'gitlab': 'GitLab',
  'vscode': 'VS Code',
  'vs code': 'VS Code',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'react': 'React',
  'python': 'Python',
  'graphql': 'GraphQL',
  'aws': 'AWS',
  'macos': 'macOS',
  'ios': 'iOS',
  'api': 'API',
  'apis': 'APIs',
  'grpc': 'gRPC',
  'json': 'JSON',
  'uuid': 'UUID',
  'rest': 'REST',
  'notion': 'Notion',
  'slack': 'Slack',
  'linear': 'Linear',
  'chatgpt': 'ChatGPT',
  'claude': 'Claude',
  'flute': 'Flute'
};

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [autoPunctuate, setAutoPunctuate] = useState(true);
  const [removeFillers, setRemoveFillers] = useState(true);
  const [whisperBoost, setWhisperBoost] = useState(false);
  const [jargonEnhance, setJargonEnhance] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [activeNav, setActiveNav] = useState('transcribe');

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const gainNodeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Check browser speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Update word count
  useEffect(() => {
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) {
      setWordCount(0);
    } else {
      const words = fullText.split(/\s+/).filter(Boolean);
      setWordCount(words.length);
    }
  }, [transcript, interimTranscript]);

  // Clean and format text (disfluency removal + proper capitalization + tech jargon mapping)
  const formatText = (text, isFinal = false) => {
    if (!text) return '';
    let cleaned = text;

    // 1. Remove verbal disfluencies / filler words if enabled
    if (removeFillers) {
      cleaned = cleaned.replace(/\b(um|uh|erm|like\s+like|you\s+know|basically|so\s+yeah)\b/gi, '');
      // Clean up multiple spaces left by removed words
      cleaned = cleaned.replace(/\s{2,}/g, ' ');
    }

    // 2. Replace technical jargon & proper nouns
    if (jargonEnhance) {
      for (const [key, replacement] of Object.entries(JARGON_MAP)) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        cleaned = cleaned.replace(regex, replacement);
      }
    }

    // 3. Sentence capitalization & punctuation
    if (autoPunctuate) {
      // Capitalize first letter of string
      cleaned = cleaned.replace(/(^\s*|\.\s+|\?\s+|\!\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
      
      // Capitalize standalone 'I'
      cleaned = cleaned.replace(/\b(i)\b/g, 'I');
      cleaned = cleaned.replace(/\b(i'm)\b/gi, "I'm");
      cleaned = cleaned.replace(/\b(i've)\b/gi, "I've");
      cleaned = cleaned.replace(/\b(i'll)\b/gi, "I'll");
      cleaned = cleaned.replace(/\b(i'd)\b/gi, "I'd");
    }

    return cleaned.trimStart();
  };

  // Start real speech recognition and audio analysis
  const startListening = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser doesn't natively support Web Speech Recognition. Please use Google Chrome, Safari, or Microsoft Edge for live voice typing.");
      return;
    }

    try {
      // 1. Request actual microphone stream for live AudioVisualizer and Whisper Boost
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      // 2. Initialize Web Audio Context & Gain Node (Whisper mode boost)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = whisperBoost ? 2.5 : 1.0;
      gainNodeRef.current = gainNode;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      source.connect(gainNode);
      gainNode.connect(analyser);

      // Start drawing live audio waveform
      drawVisualizer();

      // 3. Setup real SpeechRecognition
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        setIsListening(true);
        // Start timer
        setTimerSeconds(0);
        timerIntervalRef.current = setInterval(() => {
          setTimerSeconds((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalChunk += res[0].transcript;
          } else {
            interim += res[0].transcript;
          }
        }

        if (finalChunk) {
          const polished = formatText(finalChunk, true);
          setTranscript((prev) => {
            const separator = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
            // If previous does not end with sentence punctuation and is significant, add period
            return prev + separator + polished;
          });
          setInterimTranscript('');
        } else {
          setInterimTranscript(formatText(interim, false));
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition event:', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone permission was denied. Please allow microphone access in your browser settings.');
          stopListening();
        }
      };

      recognition.onend = () => {
        // If still supposed to be listening (e.g. slight pause in speech), auto-restart
        if (isListening && recognitionRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Already started or stopped
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (err) {
      console.error('Failed to access microphone:', err);
      alert('Could not access microphone: ' + (err.message || 'Please check browser permissions.'));
      stopListening();
    }
  };

  // Stop listening and clean up hardware audio streams
  const stopListening = () => {
    setIsListening(false);
    setInterimTranscript('');

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  };

  // Live Canvas Waveform Render
  const drawVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = Math.max(3, (dataArray[i] / 255) * canvas.height);
        ctx.fillStyle = '#181715';
        ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth - 2, barHeight);
        x += barWidth;
      }
    };

    render();
  };

  // Toggle Whisper mode gain
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = whisperBoost ? 2.5 : 1.0;
    }
  }, [whisperBoost]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Copy to clipboard
  const copyToClipboard = () => {
    const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#181715', '#4A4740', '#7E7A70']
    });
    setTimeout(() => setCopied(false), 2500);
  };

  // Clear text
  const clearText = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  // Format seconds into MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#181715] flex flex-col justify-between">
      {/* Top Editorial Navigation */}
      <header className="sticky top-0 z-40 bg-[#F8F7F4]/90 backdrop-blur-md border-b border-[#E5E2DA]">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#181715]">
              FLUTE.
            </span>
            <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-full border border-[#C7C2B4] text-[#4A4740]">
              REAL-TIME VOICE
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#transcribe"
              onClick={() => setActiveNav('transcribe')}
              className={`nav-link ${activeNav === 'transcribe' ? 'active' : ''}`}
            >
              TRANSCRIBER
            </a>
            <a
              href="#features"
              onClick={() => setActiveNav('features')}
              className={`nav-link ${activeNav === 'features' ? 'active' : ''}`}
            >
              FEATURES
            </a>
            <a
              href="#pipeline"
              onClick={() => setActiveNav('pipeline')}
              className={`nav-link ${activeNav === 'pipeline' ? 'active' : ''}`}
            >
              HOW IT WORKS
            </a>
            <a
              href="#faq"
              onClick={() => setActiveNav('faq')}
              className={`nav-link ${activeNav === 'faq' ? 'active' : ''}`}
            >
              FAQ
            </a>
          </nav>

          {/* Status Indicator */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E5E2DA] text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-rose-600 animate-ping' : 'bg-emerald-600'}`}></span>
              <span className="text-[#4A4740]">
                {isListening ? 'RECORDING LIVE' : 'MIC READY'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Editorial Hero Header */}
        <section className="pt-16 pb-10 md:pt-20 md:pb-14 px-6 max-w-5xl mx-auto text-center">
          <div className="text-xs uppercase tracking-super-wide font-mono text-[#7E7A70] mb-3">
            BROWSER-BASED DIRECT VOICE DICTATION
          </div>
          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-normal leading-[1.08] text-[#181715] tracking-tight mb-6">
            SPEAK NATURALLY. <br />
            <span className="editorial-italic font-normal">Flute transcribes</span> &amp; POLISHES <br />
            IN REAL TIME.
          </h1>
          <p className="text-base sm:text-lg text-[#4A4740] font-light max-w-2xl mx-auto leading-relaxed">
            Click the microphone below and speak into your device. Flute captures your voice directly in your browser, removes disfluencies (um, uh, like), applies punctuation, and formats technical vocabulary instantly.
          </p>
        </section>

        {/* Live Interactive Voice Transcriber Box */}
        <section id="transcribe" className="px-6 max-w-5xl mx-auto pb-16">
          <div className="card-editorial rounded-2xl border border-[#E5E2DA] bg-white shadow-sm overflow-hidden">
            {/* Box Header & Controls */}
            <div className="px-6 py-4 bg-[#F8F7F4] border-b border-[#E5E2DA] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Language Selector */}
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#4A4740]">
                  <Globe className="w-3.5 h-3.5 text-[#7E7A70]" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => {
                      setSelectedLanguage(e.target.value);
                      if (isListening) {
                        stopListening();
                        setTimeout(() => startListening(), 200);
                      }
                    }}
                    className="bg-transparent border-none text-[#181715] font-semibold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="es-ES">Español</option>
                    <option value="fr-FR">Français</option>
                    <option value="de-DE">Deutsch</option>
                    <option value="it-IT">Italiano</option>
                    <option value="ja-JP">日本語</option>
                    <option value="hi-IN">हिन्दी (Hindi)</option>
                  </select>
                </div>

                <div className="h-4 w-[1px] bg-[#E5E2DA]"></div>

                {/* Live Stats */}
                <div className="flex items-center gap-3 text-xs font-mono text-[#7E7A70]">
                  <span>{wordCount} words</span>
                  <span>•</span>
                  <span>{formatTime(timerSeconds)}</span>
                </div>
              </div>

              {/* Engine Filter Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setWhisperBoost(!whisperBoost)}
                  className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all ${
                    whisperBoost
                      ? 'bg-[#181715] text-[#F8F7F4]'
                      : 'bg-white text-[#7E7A70] border border-[#E5E2DA] hover:text-[#181715]'
                  }`}
                  title="Amplifies microphone input gain by 2.5x for low-volume whispering speech"
                >
                  <Volume2 className="w-3 h-3" />
                  <span>Whisper Boost {whisperBoost ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setRemoveFillers(!removeFillers)}
                  className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all ${
                    removeFillers
                      ? 'bg-[#181715] text-[#F8F7F4]'
                      : 'bg-white text-[#7E7A70] border border-[#E5E2DA] hover:text-[#181715]'
                  }`}
                  title="Auto-removes filler words like 'um', 'uh', 'like'"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Clean Fillers</span>
                </button>

                <button
                  onClick={() => setJargonEnhance(!jargonEnhance)}
                  className={`px-3 py-1 rounded-full text-xs font-mono flex items-center gap-1.5 transition-all ${
                    jargonEnhance
                      ? 'bg-[#181715] text-[#F8F7F4]'
                      : 'bg-white text-[#7E7A70] border border-[#E5E2DA] hover:text-[#181715]'
                  }`}
                  title="Automatically capitalizes technical nouns (FastAPI, PostgreSQL, Docker, etc.)"
                >
                  <Code2 className="w-3 h-3" />
                  <span>Tech Vocabulary</span>
                </button>
              </div>
            </div>

            {/* Live Text Area */}
            <div className="p-6 sm:p-10 min-h-[300px] flex flex-col justify-between">
              <div>
                <textarea
                  value={transcript + (interimTranscript ? ' ' + interimTranscript : '')}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={
                    isListening
                      ? "I am listening to your microphone... start speaking naturally..."
                      : "Click 'Start Voice Dictation' below and speak into your mic. Your speech will transcribe directly here."
                  }
                  className="w-full min-h-[220px] font-serif text-xl sm:text-2xl leading-relaxed text-[#181715] placeholder:text-[#A8A49A] placeholder:font-normal placeholder:italic bg-transparent border-none resize-none focus:outline-none"
                />

                {/* Real-time speech streaming indicator */}
                {isListening && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#7E7A70]">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                    <span>Streaming live audio to text...</span>
                  </div>
                )}
              </div>

              {/* Audio Visualizer & Level Meter */}
              <div className="pt-6 border-t border-[#F2EFE9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono uppercase text-[#7E7A70]">MIC INPUT:</span>
                  <canvas ref={canvasRef} width="160" height="24" className="rounded" />
                  <span className="text-[11px] font-mono text-[#7E7A70]">{audioLevel}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    disabled={!transcript && !interimTranscript}
                    className="px-4 py-2 rounded-full border border-[#E5E2DA] hover:border-[#181715] text-xs font-mono uppercase tracking-wider text-[#181715] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY TEXT'}</span>
                  </button>

                  <button
                    onClick={clearText}
                    disabled={!transcript && !interimTranscript}
                    className="px-3 py-2 rounded-full border border-[#E5E2DA] hover:border-rose-400 text-xs font-mono uppercase tracking-wider text-[#7E7A70] hover:text-rose-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                    title="Clear transcript"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Microphone Control Bar */}
            <div className="p-6 bg-[#F8F7F4] border-t border-[#E5E2DA] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 ${
                    isListening
                      ? 'bg-rose-700 text-white animate-pulse ring-4 ring-rose-200'
                      : 'bg-[#181715] hover:bg-[#33302B] text-[#F8F7F4] ring-4 ring-black/5'
                  }`}
                >
                  {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <div>
                  <div className="font-serif text-base font-semibold text-[#181715]">
                    {isListening ? 'Dictation Active — Click to Stop' : 'Start Voice Dictation'}
                  </div>
                  <div className="text-xs text-[#7E7A70] font-sans">
                    {isListening
                      ? 'Listening to microphone • Text is cleaned & formatted live'
                      : 'Requires microphone access • Zero installation needed'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-[#7E7A70]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>100% Private in your browser. Audio is never stored.</span>
              </div>
            </div>
          </div>
        </section>

        {/* The 4-Stage Architecture Pipeline Section */}
        <section id="pipeline" className="py-20 px-6 max-w-5xl mx-auto border-t border-[#E5E2DA]">
          <div className="mb-14 text-center max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-super-wide font-mono text-[#7E7A70] mb-2">
              REAL-TIME ARCHITECTURE
            </div>
            <h2 className="font-serif text-3xl sm:text-5xl font-normal text-[#181715] leading-tight">
              FROM ACOUSTIC WAVES <br />
              <span className="editorial-italic font-normal">to polished prose.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="card-editorial p-6 rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-3">STAGE 01</div>
              <h3 className="font-serif text-lg font-bold text-[#181715] mb-2">
                AUDIO CAPTURE
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Connects to Web Audio API stream with echo cancellation and auto noise reduction. Whisper Boost adds a 2.5x gain node for murmuring.
              </p>
            </div>

            <div className="card-editorial p-6 rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-3">STAGE 02</div>
              <h3 className="font-serif text-lg font-bold text-[#181715] mb-2">
                CONTINUOUS ASR
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Processes speech phonemes with sub-180ms latency, delivering real-time interim results before the sentence completes.
              </p>
            </div>

            <div className="card-editorial p-6 rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-3">STAGE 03</div>
              <h3 className="font-serif text-lg font-bold text-[#181715] mb-2">
                DISFLUENCY CLEANUP
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Strips verbal filler words (um, uh, like, so yeah) while preserving sentence intent and natural thought flow.
              </p>
            </div>

            <div className="card-editorial p-6 rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-3">STAGE 04</div>
              <h3 className="font-serif text-lg font-bold text-[#181715] mb-2">
                VOCABULARY FORMAT
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Auto-capitalizes technical nouns (FastAPI, PostgreSQL, Docker, UUID) and formats sentence punctuation.
              </p>
            </div>
          </div>
        </section>

        {/* Features Highlight */}
        <section id="features" className="py-20 px-6 max-w-5xl mx-auto border-t border-[#E5E2DA]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card-editorial p-8 rounded-2xl bg-white border border-[#E5E2DA]">
              <Volume2 className="w-6 h-6 text-[#181715] mb-4" />
              <h3 className="font-serif text-xl font-normal text-[#181715] mb-2">
                Whispering Mode
              </h3>
              <p className="text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                Toggle Whisper Boost to pick up soft murmuring under 30dB in open offices, late at night, or in quiet libraries without disturbing anyone.
              </p>
            </div>

            <div className="card-editorial p-8 rounded-2xl bg-white border border-[#E5E2DA]">
              <Sparkles className="w-6 h-6 text-[#181715] mb-4" />
              <h3 className="font-serif text-xl font-normal text-[#181715] mb-2">
                Instant Filler Cleaning
              </h3>
              <p className="text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                Speaks like you think, writes like you edit. Automatically cleans up mid-sentence pauses, disfluencies, and stuttered repetitions.
              </p>
            </div>

            <div className="card-editorial p-8 rounded-2xl bg-white border border-[#E5E2DA]">
              <ShieldCheck className="w-6 h-6 text-[#181715] mb-4" />
              <h3 className="font-serif text-xl font-normal text-[#181715] mb-2">
                100% Free &amp; Private
              </h3>
              <p className="text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                Zero fees, no subscriptions, and no downloads required. Your voice stream stays right in your browser.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 px-6 max-w-4xl mx-auto border-t border-[#E5E2DA]">
          <div className="mb-12">
            <div className="text-xs uppercase tracking-super-wide font-mono text-[#7E7A70] mb-2">
              HELP &amp; INSTRUCTIONS
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#181715]">
              FREQUENTLY <span className="editorial-italic">asked questions.</span>
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                q: "Do I need to download or install any software?",
                a: "No! This version of Flute runs directly inside your web browser using modern Web Speech and Web Audio APIs. You can dictate right here on this page, and copy the polished text to paste anywhere."
              },
              {
                q: "Which browsers are supported?",
                a: "Google Chrome, Microsoft Edge, and Apple Safari offer full native speech recognition support. For the best experience with live streaming transcripts, Google Chrome and Microsoft Edge on macOS and Windows are recommended."
              },
              {
                q: "How does Whisper Boost work?",
                a: "Whisper Boost dynamically inserts an audio GainNode into the Web Audio API pipeline with a 2.5x gain multiplier, boosting low-amplitude quiet speech and whispers so speech recognition models pick it up clearly."
              },
              {
                q: "How does the jargon and filler word cleanup work?",
                a: "As audio frames are transcribed, our client-side normalization engine removes conversational disfluencies (such as 'um', 'uh', 'like') and maps spoken technical terms (e.g. 'postgres' to 'PostgreSQL', 'fast api' to 'FastAPI') while formatting punctuation."
              }
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="card-editorial rounded-xl p-5 bg-white border border-[#E5E2DA] transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full flex items-center justify-between text-left font-serif text-base font-semibold text-[#181715]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#7E7A70] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="mt-3 pt-3 border-t border-[#F2EFE9] text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-[#E5E2DA] bg-[#F8F7F4] text-xs text-[#7E7A70] font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-serif text-lg font-bold text-[#181715]">FLUTE.</span>
            <span>Real-time voice dictation &amp; transcription in your browser.</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#transcribe" className="hover:text-[#181715] transition-colors">TRANSCRIBER</a>
            <a href="#pipeline" className="hover:text-[#181715] transition-colors">PIPELINE</a>
            <a href="#features" className="hover:text-[#181715] transition-colors">FEATURES</a>
            <a href="#faq" className="hover:text-[#181715] transition-colors">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Volume2,
  Copy,
  Check,
  RotateCcw,
  Globe,
  Code2,
  ShieldCheck,
  ChevronDown,
  Menu,
  X,
  AlertCircle
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

// Environment settings loaded from .env
const ENV_APP_NAME = import.meta.env.VITE_APP_NAME || 'FLUTE';
const ENV_LANG = import.meta.env.VITE_DEFAULT_LANGUAGE || 'en-US';
const ENV_AUTO_PUNCTUATE = import.meta.env.VITE_AUTO_PUNCTUATION !== 'false';
const ENV_REMOVE_FILLERS = import.meta.env.VITE_REMOVE_FILLERS !== 'false';
const ENV_JARGON_ENHANCE = import.meta.env.VITE_JARGON_ENHANCE !== 'false';
const ENV_WHISPER_BOOST = import.meta.env.VITE_WHISPER_BOOST_DEFAULT === 'true';
const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';
const LLM_MODEL = import.meta.env.VITE_LLM_MODEL || 'llama-3.1-8b-instant';

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [autoPunctuate, setAutoPunctuate] = useState(ENV_AUTO_PUNCTUATE);
  const [removeFillers, setRemoveFillers] = useState(ENV_REMOVE_FILLERS);
  const [whisperBoost, setWhisperBoost] = useState(ENV_WHISPER_BOOST);
  const [jargonEnhance, setJargonEnhance] = useState(ENV_JARGON_ENHANCE);
  const [selectedLanguage, setSelectedLanguage] = useState(ENV_LANG);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);
  const [activeNav, setActiveNav] = useState('transcribe');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Mutable refs to prevent stale closures and manage hardware
  const isListeningRef = useRef(false);
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const gainNodeRef = useRef(null);
  const animationFrameRef = useRef(null);
  const simulatedAnimationRef = useRef(null);
  const canvasRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const wakeLockRef = useRef(null);
  const interimTranscriptRef = useRef('');
  const whisperBoostRef = useRef(whisperBoost);

  // Helper: detect mobile or touch device
  const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1)
    );
  };

  // Sync refs with state
  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    whisperBoostRef.current = whisperBoost;
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = whisperBoost ? 2.5 : 1.0;
    }
  }, [whisperBoost]);

  // Check browser speech recognition support on mount
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      setErrorMessage(
        'Speech Recognition is not natively supported in this browser. On iPhone/iPad, please use Safari. On Android, please use Chrome or Samsung Internet.'
      );
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
      cleaned = cleaned.replace(/(^\s*|\.\s+|\?\s+|\!\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
      cleaned = cleaned.replace(/\b(i)\b/g, 'I');
      cleaned = cleaned.replace(/\b(i'm)\b/gi, "I'm");
      cleaned = cleaned.replace(/\b(i've)\b/gi, "I've");
      cleaned = cleaned.replace(/\b(i'll)\b/gi, "I'll");
      cleaned = cleaned.replace(/\b(i'd)\b/gi, "I'd");
    }

    return cleaned.trimStart();
  };

  // Hardware WebAudio waveform visualizer (used on desktop where concurrent mic access is safe)
  const drawHardwareVisualizer = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!isListeningRef.current) return;
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
        const barHeight = Math.max(2, (dataArray[i] / 255) * canvas.height);
        ctx.fillStyle = '#181715';
        ctx.fillRect(x, (canvas.height - barHeight) / 2, Math.max(1, barWidth - 2), barHeight);
        x += barWidth;
      }
    };

    render();
  };

  // Speech-reactive visualizer (used on mobile to prevent locking the audio hardware from WebKit / Android Speech)
  const startSpeechVisualizer = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let step = 0;

    const render = () => {
      if (!isListeningRef.current) return;
      simulatedAnimationRef.current = requestAnimationFrame(render);
      step += 0.18;

      const numBars = 16;
      const barWidth = canvas.width / numBars;
      const isSpeaking = Boolean(interimTranscriptRef.current);
      const baseIntensity = isSpeaking ? 0.75 : 0.22;

      setAudioLevel(Math.min(100, Math.round(baseIntensity * 65 + Math.sin(step * 2) * 20)));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < numBars; i++) {
        const wave = Math.sin(step + i * 0.45) * 0.5 + 0.5;
        const heightRatio = baseIntensity * wave * (whisperBoostRef.current ? 1.3 : 1.0);
        const barHeight = Math.max(2, Math.min(canvas.height, heightRatio * canvas.height));
        ctx.fillStyle = '#181715';
        ctx.fillRect(i * barWidth, (canvas.height - barHeight) / 2, Math.max(1, barWidth - 2), barHeight);
      }
    };

    render();
  };

  // Start speech recognition
  const startListening = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage(
        "Your browser doesn't natively support Web Speech Recognition. On iOS, please use Safari; on Android, use Google Chrome."
      );
      return;
    }

    setErrorMessage(null);

    // Keep screen awake while dictating on mobile devices
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (e) {
        // Silently ignore if denied or unsupported
      }
    }

    const mobile = isMobileDevice();

    // On desktop, attempt non-blocking WebAudio analyser for the visualizer.
    // On mobile devices (iOS/Android), calling getUserMedia locks the hardware audio session
    // away from Apple WebKit / Android Speech recognition daemon, causing immediate 'not-allowed' or 'audio-capture' errors.
    // Therefore, on mobile we use startSpeechVisualizer() to keep speech recognition 100% reliable.
    if (!mobile && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;

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

        drawHardwareVisualizer();
      } catch (err) {
        console.warn('WebAudio hardware visualizer unavailable, using speech visualizer fallback:', err);
        startSpeechVisualizer();
      }
    } else {
      startSpeechVisualizer();
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);

        if (!timerIntervalRef.current) {
          setTimerSeconds(0);
          timerIntervalRef.current = setInterval(() => {
            setTimerSeconds((prev) => prev + 1);
          }, 1000);
        }
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
            return prev + separator + polished;
          });
          setInterimTranscript('');
        } else {
          setInterimTranscript(formatText(interim, false));
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'no-speech') {
          // Normal silence pause on mobile — do not stop, onend will auto-restart
          return;
        }
        if (event.error === 'aborted') {
          // Interrupted by pause or stop
          return;
        }
        if (event.error === 'not-allowed') {
          setErrorMessage(
            'Microphone access was denied. Please allow microphone permissions in your mobile browser settings.'
          );
          stopListening();
          return;
        }
        if (event.error === 'audio-capture') {
          setErrorMessage('Microphone is in use by another application or unavailable.');
          stopListening();
          return;
        }
        if (event.error === 'network') {
          setErrorMessage('Network connection lost. Speech recognition on mobile requires an internet connection.');
          return;
        }
      };

      recognition.onend = () => {
        // Crucial fix: check isListeningRef.current instead of stale closure!
        // Mobile browsers frequently end continuous recognition on speech pauses.
        if (isListeningRef.current && recognitionRef.current) {
          clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // Ignore if already active
              }
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      isListeningRef.current = true;
      recognition.start();

    } catch (err) {
      console.error('Failed to initialize speech recognition:', err);
      setErrorMessage('Could not start voice dictation: ' + (err.message || 'Please check microphone permissions.'));
      stopListening();
    }
  };

  // Stop listening and clean up all streams & timers
  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    setInterimTranscript('');

    clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = null;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (simulatedAnimationRef.current) {
      cancelAnimationFrame(simulatedAnimationRef.current);
      simulatedAnimationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }

    setAudioLevel(0);

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Polish with AI (LLM if configured, else instant rule-based polish)
  const polishWithAI = async () => {
    const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (!fullText) return;

    if (!GROQ_KEY && !OPENAI_KEY) {
      const cleaned = formatText(fullText, true);
      setTranscript(cleaned);
      setInterimTranscript('');
      return;
    }

    setIsPolishing(true);
    try {
      const isGroq = Boolean(GROQ_KEY);
      const endpoint = isGroq
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
      const authHeader = `Bearer ${isGroq ? GROQ_KEY : OPENAI_KEY}`;
      const model = isGroq ? LLM_MODEL : 'gpt-4o-mini';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are an executive voice typing engine. Clean up conversational disfluencies (um, uh, like), add proper punctuation and capitalization, and format technical terms properly. Do not add conversational commentary or quotes. Return ONLY the polished final text.',
            },
            { role: 'user', content: fullText },
          ],
          temperature: 0.1,
        }),
      });

      const data = await res.json();
      if (data.choices && data.choices[0]?.message?.content) {
        setTranscript(data.choices[0].message.content.trim());
        setInterimTranscript('');
      }
    } catch (err) {
      console.warn('AI polishing fallback:', err);
    } finally {
      setIsPolishing(false);
    }
  };

  // Robust clipboard copy with fallback for mobile browsers
  const copyToClipboard = async () => {
    const fullText = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();
    if (!fullText) return;

    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(fullText);
        success = true;
      } catch (err) {
        console.warn('Clipboard writeText failed, trying fallback:', err);
      }
    }

    if (!success) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = fullText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
    }

    if (success) {
      setCopied(true);
      try {
        confetti({
          particleCount: 40,
          spread: 45,
          origin: { y: 0.7 },
          colors: ['#181715', '#4A4740', '#7E7A70']
        });
      } catch (e) {}
      setTimeout(() => setCopied(false), 2000);
    }
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

  const handleNavClick = (sectionId) => {
    setActiveNav(sectionId);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#181715] flex flex-col justify-between selection:bg-[#181715] selection:text-[#F8F7F4]">
      {/* Top Editorial Navigation */}
      <header className="sticky top-0 z-40 bg-[#F8F7F4]/95 backdrop-blur-md border-b border-[#E5E2DA]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-[#181715]">
              FLUTE.
            </span>
            <span className="hidden sm:inline-block text-[9px] sm:text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-full border border-[#C7C2B4] text-[#4A4740]">
              REAL-TIME VOICE
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#transcribe"
              onClick={() => handleNavClick('transcribe')}
              className={`nav-link ${activeNav === 'transcribe' ? 'active' : ''}`}
            >
              TRANSCRIBER
            </a>
            <a
              href="#features"
              onClick={() => handleNavClick('features')}
              className={`nav-link ${activeNav === 'features' ? 'active' : ''}`}
            >
              FEATURES
            </a>
            <a
              href="#pipeline"
              onClick={() => handleNavClick('pipeline')}
              className={`nav-link ${activeNav === 'pipeline' ? 'active' : ''}`}
            >
              HOW IT WORKS
            </a>
            <a
              href="#faq"
              onClick={() => handleNavClick('faq')}
              className={`nav-link ${activeNav === 'faq' ? 'active' : ''}`}
            >
              FAQ
            </a>
          </nav>

          {/* Right Header Status & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white border border-[#E5E2DA] text-[11px] sm:text-xs font-mono">
              <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-rose-600 animate-ping' : 'bg-emerald-600'}`}></span>
              <span className="text-[#4A4740] font-medium">
                {isListening ? 'LIVE' : 'MIC READY'}
              </span>
            </div>

            {/* Mobile Menu Hamburger Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-[#181715] hover:bg-[#E5E2DA]/50 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#F8F7F4] border-b border-[#E5E2DA] px-6 py-4 space-y-3 animate-in fade-in duration-150">
            <a
              href="#transcribe"
              onClick={() => handleNavClick('transcribe')}
              className="block font-serif text-sm tracking-wider uppercase py-2 text-[#181715] border-b border-[#E5E2DA]/60"
            >
              Transcriber
            </a>
            <a
              href="#features"
              onClick={() => handleNavClick('features')}
              className="block font-serif text-sm tracking-wider uppercase py-2 text-[#4A4740] hover:text-[#181715] border-b border-[#E5E2DA]/60"
            >
              Features
            </a>
            <a
              href="#pipeline"
              onClick={() => handleNavClick('pipeline')}
              className="block font-serif text-sm tracking-wider uppercase py-2 text-[#4A4740] hover:text-[#181715] border-b border-[#E5E2DA]/60"
            >
              How It Works
            </a>
            <a
              href="#faq"
              onClick={() => handleNavClick('faq')}
              className="block font-serif text-sm tracking-wider uppercase py-2 text-[#4A4740] hover:text-[#181715]"
            >
              FAQ
            </a>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-full">
        {/* Editorial Hero Header */}
        <section className="pt-8 pb-6 sm:pt-16 sm:pb-10 md:pt-20 md:pb-14 px-4 sm:px-6 max-w-5xl mx-auto text-center">
          <div className="text-[10px] sm:text-xs uppercase tracking-super-wide font-mono text-[#7E7A70] mb-2 sm:mb-3">
            BROWSER-BASED DIRECT VOICE DICTATION
          </div>
          <h1 className="font-serif text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-normal leading-[1.12] sm:leading-[1.08] text-[#181715] tracking-tight mb-4 sm:mb-6">
            SPEAK NATURALLY. <br />
            <span className="editorial-italic font-normal">Flute transcribes</span> &amp; POLISHES <br />
            IN REAL TIME.
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-[#4A4740] font-light max-w-2xl mx-auto leading-relaxed">
            Click the microphone below and speak into your device. Flute captures your voice directly in your browser, removes disfluencies, applies punctuation, and formats technical vocabulary instantly.
          </p>
        </section>

        {/* Live Interactive Voice Transcriber Box */}
        <section id="transcribe" className="px-3 sm:px-6 max-w-5xl mx-auto pb-12 sm:pb-16">
          {/* In-app Error & Guidance Banner */}
          {errorMessage && (
            <div className="mb-4 p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5 text-xs sm:text-sm">Microphone Notice</p>
                <p className="text-amber-800 leading-relaxed text-xs sm:text-sm">{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className="text-amber-700 hover:text-amber-900 text-[10px] sm:text-xs font-mono font-bold px-2 py-1"
              >
                DISMISS
              </button>
            </div>
          )}

          {/* Browser Incompatibility Notice */}
          {!isSupported && (
            <div className="mb-4 sm:mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold mb-1">Mobile Browser Compatibility</p>
                <p className="text-rose-800 leading-relaxed text-xs sm:text-sm">
                  Your current browser doesn't support the native Web Speech API. For full real-time speech dictation:
                  <br />• <strong>iPhone / iPad:</strong> Open this page in <strong>Apple Safari</strong>.
                  <br />• <strong>Android:</strong> Open this page in <strong>Google Chrome</strong> or <strong>Samsung Internet</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="card-editorial rounded-xl sm:rounded-2xl border border-[#E5E2DA] bg-white shadow-sm overflow-hidden">
            {/* Box Header & Controls */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#F8F7F4] border-b border-[#E5E2DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4">
                {/* Language Selector */}
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#4A4740]">
                  <Globe className="w-3.5 h-3.5 text-[#7E7A70] flex-shrink-0" />
                  <select
                    value={selectedLanguage}
                    onChange={(e) => {
                      setSelectedLanguage(e.target.value);
                      if (isListeningRef.current) {
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
                <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono text-[#7E7A70]">
                  <span>{wordCount} words</span>
                  <span>•</span>
                  <span>{formatTime(timerSeconds)}</span>
                </div>
              </div>

              {/* Engine Filter Toggles - Responsive horizontal pills */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                <button
                  onClick={() => setWhisperBoost(!whisperBoost)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-mono flex items-center gap-1 sm:gap-1.5 flex-shrink-0 transition-all ${
                    whisperBoost
                      ? 'bg-[#181715] text-[#F8F7F4]'
                      : 'bg-white text-[#7E7A70] border border-[#E5E2DA] hover:text-[#181715]'
                  }`}
                  title="Amplifies microphone input gain for soft speech"
                >
                  <Volume2 className="w-3 h-3 flex-shrink-0" />
                  <span>Whisper Boost {whisperBoost ? 'ON' : 'OFF'}</span>
                </button>

                <button
                  onClick={() => setRemoveFillers(!removeFillers)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-mono flex items-center gap-1 sm:gap-1.5 flex-shrink-0 transition-all ${
                    removeFillers
                      ? 'bg-[#181715] text-[#F8F7F4]'
                      : 'bg-white text-[#7E7A70] border border-[#E5E2DA] hover:text-[#181715]'
                  }`}
                  title="Auto-removes filler words like 'um', 'uh', 'like'"
                >
                  <Sparkles className="w-3 h-3 flex-shrink-0" />
                  <span>Clean Fillers</span>
                </button>

                <button
                  onClick={() => setJargonEnhance(!jargonEnhance)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-mono flex items-center gap-1 sm:gap-1.5 flex-shrink-0 transition-all ${
                    jargonEnhance
                      ? 'bg-[#181715] text-[#F8F7F4]'
                      : 'bg-white text-[#7E7A70] border border-[#E5E2DA] hover:text-[#181715]'
                  }`}
                  title="Automatically capitalizes technical nouns"
                >
                  <Code2 className="w-3 h-3 flex-shrink-0" />
                  <span>Tech Vocabulary</span>
                </button>
              </div>
            </div>

            {/* Live Text Area */}
            <div className="p-4 sm:p-8 md:p-10 min-h-[260px] sm:min-h-[300px] flex flex-col justify-between">
              <div>
                <textarea
                  value={transcript + (interimTranscript ? ' ' + interimTranscript : '')}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    setInterimTranscript('');
                  }}
                  placeholder={
                    isListening
                      ? "Listening to microphone... speak naturally..."
                      : "Tap 'Start Voice Dictation' below and speak into your mic. Your speech will transcribe here in real time."
                  }
                  className="w-full min-h-[160px] sm:min-h-[220px] font-serif text-lg sm:text-xl md:text-2xl leading-relaxed text-[#181715] placeholder:text-[#A8A49A] placeholder:font-normal placeholder:italic bg-transparent border-none resize-none focus:outline-none"
                />

                {/* Real-time speech streaming indicator */}
                {isListening && (
                  <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#7E7A70]">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                    <span>Streaming live audio to text...</span>
                  </div>
                )}
              </div>

              {/* Audio Visualizer & Action Buttons bar - Fully Mobile Responsive */}
              <div className="pt-4 sm:pt-6 border-t border-[#F2EFE9] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                {/* Visualizer & Mic Meter */}
                <div className="flex items-center justify-between sm:justify-start gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase text-[#7E7A70] tracking-wider">MIC INPUT:</span>
                    <canvas ref={canvasRef} width="140" height="22" className="rounded w-28 sm:w-36 h-5 sm:h-6" />
                  </div>
                  <span className="text-[11px] font-mono text-[#7E7A70] px-2 py-0.5 rounded bg-[#F8F7F4] border border-[#E5E2DA]">{audioLevel}%</span>
                </div>

                {/* Actions: AI Polish, Copy, Clear */}
                <div className="grid grid-cols-3 sm:flex items-center gap-2">
                  <button
                    onClick={polishWithAI}
                    disabled={(!transcript && !interimTranscript) || isPolishing}
                    className="px-2.5 sm:px-4 py-2 rounded-full border border-[#E5E2DA] hover:border-[#181715] text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#181715] transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                    title="Deep AI formatting and filler cleanup"
                  >
                    <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${isPolishing ? 'animate-spin text-amber-600' : 'text-amber-500'}`} />
                    <span>{isPolishing ? 'POLISH...' : 'AI POLISH'}</span>
                  </button>

                  <button
                    onClick={copyToClipboard}
                    disabled={!transcript && !interimTranscript}
                    className="px-2.5 sm:px-4 py-2 rounded-full border border-[#E5E2DA] hover:border-[#181715] text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#181715] transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span>{copied ? 'COPIED' : 'COPY'}</span>
                  </button>

                  <button
                    onClick={clearText}
                    disabled={!transcript && !interimTranscript}
                    className="px-2.5 sm:px-3 py-2 rounded-full border border-[#E5E2DA] hover:border-rose-400 text-[11px] sm:text-xs font-mono uppercase tracking-wider text-[#7E7A70] hover:text-rose-600 transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
                    title="Clear transcript"
                  >
                    <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="sm:hidden">CLEAR</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Microphone Control Bar */}
            <div className="p-4 sm:p-6 bg-[#F8F7F4] border-t border-[#E5E2DA] flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                  onClick={isListening ? stopListening : startListening}
                  aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center transition-all shadow-md active:scale-95 touch-manipulation ${
                    isListening
                      ? 'bg-rose-700 text-white animate-pulse ring-4 ring-rose-200'
                      : 'bg-[#181715] hover:bg-[#33302B] text-[#F8F7F4] ring-4 ring-black/5'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
                </button>

                <div className="flex-1">
                  <div className="font-serif text-sm sm:text-base font-semibold text-[#181715]">
                    {isListening ? 'Dictation Active — Tap to Stop' : 'Start Voice Dictation'}
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#7E7A70] font-sans">
                    {isListening
                      ? 'Listening to microphone • Text formatted live'
                      : 'Requires microphone access • Zero installation needed'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono text-[#7E7A70] text-center sm:text-left">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>100% Private in your browser. Audio is never stored.</span>
              </div>
            </div>
          </div>
        </section>

        {/* The 4-Stage Architecture Pipeline Section */}
        <section id="pipeline" className="py-14 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-[#E5E2DA]">
          <div className="mb-10 sm:mb-14 text-center max-w-2xl mx-auto">
            <div className="text-[10px] sm:text-xs uppercase tracking-super-wide font-mono text-[#7E7A70] mb-2">
              REAL-TIME ARCHITECTURE
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl md:text-5xl font-normal text-[#181715] leading-tight">
              FROM ACOUSTIC WAVES <br />
              <span className="editorial-italic font-normal">to polished prose.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <div className="card-editorial p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-2 sm:mb-3">STAGE 01</div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#181715] mb-2">
                AUDIO CAPTURE
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Connects to the native device audio subsystem with echo cancellation and auto noise reduction. Whisper Boost adds a 2.5x gain multiplier for soft murmuring.
              </p>
            </div>

            <div className="card-editorial p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-2 sm:mb-3">STAGE 02</div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#181715] mb-2">
                CONTINUOUS ASR
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Processes speech phonemes with sub-180ms latency, delivering real-time interim results before each sentence completes.
              </p>
            </div>

            <div className="card-editorial p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-2 sm:mb-3">STAGE 03</div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#181715] mb-2">
                DISFLUENCY CLEANUP
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Strips verbal filler words (um, uh, like, so yeah) while preserving sentence intent and natural thought flow.
              </p>
            </div>

            <div className="card-editorial p-5 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <div className="text-xs font-mono text-[#7E7A70] mb-2 sm:mb-3">STAGE 04</div>
              <h3 className="font-serif text-base sm:text-lg font-bold text-[#181715] mb-2">
                VOCABULARY FORMAT
              </h3>
              <p className="text-xs text-[#4A4740] font-light leading-relaxed">
                Auto-capitalizes technical nouns (FastAPI, PostgreSQL, Docker, UUID) and formats sentence punctuation.
              </p>
            </div>
          </div>
        </section>

        {/* Features Highlight */}
        <section id="features" className="py-14 sm:py-20 px-4 sm:px-6 max-w-5xl mx-auto border-t border-[#E5E2DA]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            <div className="card-editorial p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <Volume2 className="w-6 h-6 text-[#181715] mb-4" />
              <h3 className="font-serif text-lg sm:text-xl font-normal text-[#181715] mb-2">
                Whispering Mode
              </h3>
              <p className="text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                Toggle Whisper Boost to pick up soft murmuring under 30dB in open offices, late at night, or in quiet libraries without disturbing anyone.
              </p>
            </div>

            <div className="card-editorial p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <Sparkles className="w-6 h-6 text-[#181715] mb-4" />
              <h3 className="font-serif text-lg sm:text-xl font-normal text-[#181715] mb-2">
                Instant Filler Cleaning
              </h3>
              <p className="text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                Speaks like you think, writes like you edit. Automatically cleans up mid-sentence pauses, disfluencies, and stuttered repetitions.
              </p>
            </div>

            <div className="card-editorial p-6 sm:p-8 rounded-xl sm:rounded-2xl bg-white border border-[#E5E2DA]">
              <ShieldCheck className="w-6 h-6 text-[#181715] mb-4" />
              <h3 className="font-serif text-lg sm:text-xl font-normal text-[#181715] mb-2">
                100% Free &amp; Private
              </h3>
              <p className="text-xs sm:text-sm text-[#4A4740] font-light leading-relaxed">
                Zero fees, no subscriptions, and no downloads required. Your voice stream stays right in your browser.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-14 sm:py-20 px-4 sm:px-6 max-w-4xl mx-auto border-t border-[#E5E2DA]">
          <div className="mb-8 sm:mb-12">
            <div className="text-[10px] sm:text-xs uppercase tracking-super-wide font-mono text-[#7E7A70] mb-2">
              HELP &amp; INSTRUCTIONS
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal text-[#181715]">
              FREQUENTLY <span className="editorial-italic">asked questions.</span>
            </h2>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {[
              {
                q: "Does this work on mobile phones (iPhone & Android)?",
                a: "Yes! Flute is optimized for mobile phones. On iPhone and iPad, use Safari for full native Web Speech dictation. On Android, use Google Chrome or Samsung Internet. Simply tap the microphone button and grant microphone permission when prompted."
              },
              {
                q: "Do I need to download or install any software?",
                a: "No! Flute runs directly inside your web browser using modern Web Speech standards. You can dictate right here on this page and easily copy your text with one tap."
              },
              {
                q: "Why was the microphone not starting or permission denied?",
                a: "Mobile browsers require you to allow microphone access. If you accidentally denied it, tap the lock or 'AA' settings icon in your mobile browser's address bar, enable Microphone access, and reload the page."
              },
              {
                q: "How does Whisper Boost work?",
                a: "Whisper Boost dynamically scales low-amplitude speech signals and quiet murmurs so continuous speech models pick up quiet whispers in open offices or quiet spaces."
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
                  className="card-editorial rounded-xl p-4 sm:p-5 bg-white border border-[#E5E2DA] transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                    className="w-full flex items-center justify-between text-left font-serif text-sm sm:text-base font-semibold text-[#181715] gap-3"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#7E7A70] flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
      <footer className="py-8 sm:py-10 px-4 sm:px-6 border-t border-[#E5E2DA] bg-[#F8F7F4] text-xs text-[#7E7A70] font-mono">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
            <span className="font-serif text-base sm:text-lg font-bold text-[#181715]">FLUTE.</span>
            <span>Real-time voice dictation &amp; transcription in your browser.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <a href="#transcribe" onClick={() => handleNavClick('transcribe')} className="hover:text-[#181715] transition-colors">TRANSCRIBER</a>
            <a href="#pipeline" onClick={() => handleNavClick('pipeline')} className="hover:text-[#181715] transition-colors">PIPELINE</a>
            <a href="#features" onClick={() => handleNavClick('features')} className="hover:text-[#181715] transition-colors">FEATURES</a>
            <a href="#faq" onClick={() => handleNavClick('faq')} className="hover:text-[#181715] transition-colors">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

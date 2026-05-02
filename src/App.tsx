import { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Youtube, 
  Languages, 
  Play, 
  Download, 
  RefreshCcw, 
  Loader2, 
  FileText, 
  Type as MarkdownIcon,
  ChevronDown,
  ExternalLink,
  Copyright
} from "lucide-react";
import { saveAs } from "file-saver";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

// Initializing Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type AppState = "input" | "loading" | "result";

export default function App() {
  const [state, setState] = useState<AppState>("input");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<"Arabic" | "English">("English");
  const [loadingStep, setLoadingStep] = useState("");
  const [transcript, setTranscript] = useState<string>("");
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartTranscription = async () => {
    if (!url.trim()) return;
    
    setState("loading");
    setTranscript("");
    
    try {
      setLoadingStep("Fetching video metadata...");
      const infoRes = await fetch(`/api/video-info?url=${encodeURIComponent(url)}`);
      if (!infoRes.ok) throw new Error("Failed to get video info. This video might be unavailable or age-restricted.");
      const info = await infoRes.json();
      setVideoInfo(info);

      setLoadingStep("Processing audio stream...");
      // We fetch the audio via our proxy to avoid CORS
      const audioRes = await fetch(`/api/proxy-audio?url=${encodeURIComponent(info.audioUrl)}`);
      if (!audioRes.ok) throw new Error("Failed to process audio stream.");
      
      const audioBlob = await audioRes.blob();
      
      setLoadingStep("Preparing audio for AI...");
      const base64Data = await blobToBase64(audioBlob);
      
      setLoadingStep(`Transcribing audio in ${language}...`);
      
      const prompt = `Transcribe the following audio in ${language}. 
      Mandatory requirements:
      1. Include timestamps for every significant speaker change or at least every 30-60 seconds in the format [MM:SS] or [HH:MM:SS].
      2. Identify speakers if possible (e.g., "Speaker 1", "Speaker 2" or their real names if detectable).
      3. Maintain high precision and clean formatting.
      4. If the language is Arabic, ensure modern standard Arabic or the speaker's dialect is captured accurately.
      5. Output ONLY the transcription content with timestamps and speaker names.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "audio/mpeg",
                  data: base64Data.split(",")[1]
                }
              }
            ]
          }
        ]
      });

      if (!response.text) throw new Error("No transcription generated.");
      
      setTranscript(response.text);
      setState("result");
    } catch (err: any) {
      console.error(err);
      alert(`Transcription Failed: ${err.message}`);
      setState("input");
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const exportMarkdown = () => {
    const content = `# Transcription: ${videoInfo?.title || "YouTube Video"}\n\nLanguage: ${language}\n\n${transcript}`;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `${videoInfo?.title || "transcript"}.md`);
    setShowExportMenu(false);
  };

  const exportWord = async () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: `Transcription: ${videoInfo?.title || "YouTube Video"}`,
              heading: HeadingLevel.HEADING_1,
            }),
            new Paragraph({
              text: `Source: ${url}`,
            }),
            new Paragraph({
              text: `Language: ${language}`,
            }),
            new Paragraph({
              text: "", // Spacer
            }),
            ...transcript.split('\n').map(line => new Paragraph({
              children: [new TextRun(line)],
            })),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${videoInfo?.title || "transcript"}.docx`);
    setShowExportMenu(false);
  };

  const resetSession = () => {
    setUrl("");
    setVideoInfo(null);
    setTranscript("");
    setState("input");
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Top Left Header */}
      <header className="fixed top-0 left-0 p-6 z-50">
        <h2 className="text-xl font-bold tracking-tighter text-orange-600">
          Cognicly Inc.
        </h2>
      </header>

      {/* Main Content */}
      <main className="min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-32">
        <AnimatePresence mode="wait">
          {state === "input" && (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl space-y-12"
            >
              {/* Headlines */}
              <div className="text-center space-y-4">
                <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900">
                  Instantly transcribe YouTube
                </h1>
                <p className="text-xl md:text-2xl text-gray-500 font-medium italic">
                  podcasts with AI-powered precision
                </p>
              </div>

              {/* Input Form */}
              <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 space-y-8">
                <div className="space-y-3">
                  <label htmlFor="url" className="text-sm font-semibold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <Youtube className="w-4 h-4" />
                    Enter YouTube Video Link
                  </label>
                  <input 
                    id="url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full p-4 text-lg bg-gray-50 rounded-2xl border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all outline-none"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-widest text-gray-400">
                    <Languages className="w-4 h-4" />
                    Choose Language
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setLanguage("Arabic")}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all ${
                        language === "Arabic" 
                        ? "border-orange-500 bg-orange-50 text-orange-600" 
                        : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      Arabic Transcript
                    </button>
                    <button 
                      onClick={() => setLanguage("English")}
                      className={`p-4 rounded-2xl border-2 font-bold transition-all ${
                        language === "English" 
                        ? "border-orange-500 bg-orange-50 text-orange-600" 
                        : "border-gray-100 bg-white hover:border-gray-200"
                      }`}
                    >
                      English Transcript
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleStartTranscription}
                  disabled={!url}
                  className="w-full py-5 rounded-2xl bg-orange-600 text-white text-xl font-bold hover:bg-orange-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(234,88,12,0.3)] shadow-orange-200"
                >
                  <Play className="w-6 h-6 fill-current" />
                  Start Transcription
                </button>
              </div>
            </motion.div>
          )}

          {state === "loading" && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center gap-8"
            >
              <div className="relative">
                <Loader2 className="w-20 h-20 text-orange-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 bg-orange-100 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-gray-800">Processing Podcast</h3>
                <p className="text-gray-500 font-medium animate-pulse">{loadingStep}</p>
              </div>
            </motion.div>
          )}

          {state === "result" && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl space-y-8"
            >
              {/* Result Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-6">
                  {videoInfo?.thumbnail && (
                    <img 
                      src={videoInfo.thumbnail} 
                      alt="Thumbnail" 
                      className="w-32 h-20 object-cover rounded-xl shadow-lg"
                    />
                  )}
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight line-clamp-1">{videoInfo?.title}</h3>
                    <p className="text-gray-500 flex items-center gap-2">
                      {videoInfo?.author} • {language}
                      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition-colors">
                        <ExternalLink className="w-4 h-4 inline" />
                      </a>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative" ref={dropdownRef}>
                    <button 
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="px-6 py-3 bg-white border-2 border-gray-100 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      Export Options
                      <ChevronDown className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showExportMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 overflow-hidden"
                        >
                          <button 
                            onClick={exportWord}
                            className="w-full px-5 py-4 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50"
                          >
                            <FileText className="w-5 h-5 text-blue-500" />
                            <div className="text-left">
                              <p className="font-bold text-sm">Word Document</p>
                              <p className="text-xs text-gray-400">Microsoft Word (.docx)</p>
                            </div>
                          </button>
                          <button 
                            onClick={exportMarkdown}
                            className="w-full px-5 py-4 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors"
                          >
                            <MarkdownIcon className="w-5 h-5 text-gray-600" />
                            <div className="text-left">
                              <p className="font-bold text-sm">Markdown File</p>
                              <p className="text-xs text-gray-400">Pure text (.md)</p>
                            </div>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    onClick={resetSession}
                    className="px-6 py-3 bg-[#1a1a1a] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    New YouTube Link
                  </button>
                </div>
              </div>

              {/* Transcript Display */}
              <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Transcript Preview</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                  </div>
                </div>
                <div className="p-8 md:p-12 h-[600px] overflow-y-auto scroll-smooth">
                  <div className={`whitespace-pre-wrap leading-relaxed transition-all text-lg ${language === 'Arabic' ? 'text-right font-light' : 'text-left font-normal animate-in fade-in slide-in-from-bottom-2'}`} dir={language === 'Arabic' ? 'rtl' : 'ltr'}>
                    {transcript}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Left Footer */}
      <footer className="fixed bottom-0 left-0 p-6 z-50">
        <div className="flex items-center gap-2 text-sm text-gray-400 font-medium tracking-tight">
          <Copyright className="w-3 h-3" />
          © 2026 Cognicly Inc.
        </div>
      </footer>

      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-100/30 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/30 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}

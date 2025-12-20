import React, { useState } from 'react';
import { Sparkles, Loader2, Palette, Type } from 'lucide-react';
import { GeminiAnalysisResult } from '../types';
import { analyzeImageStyle } from '../services/geminiService';

interface GeminiPanelProps {
  currentFrameBase64: string | null;
  onApplyAnalysis: (result: GeminiAnalysisResult) => void;
}

const GeminiPanel: React.FC<GeminiPanelProps> = ({ currentFrameBase64, onApplyAnalysis }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeminiAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!currentFrameBase64) return;
    
    setLoading(true);
    try {
      const analysis = await analyzeImageStyle(currentFrameBase64);
      setResult(analysis);
      onApplyAnalysis(analysis);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          <Sparkles size={20} className="text-purple-400" />
          Gemini Style Engine
        </h3>
        
        {!result && !loading && (
          <button
            onClick={handleAnalyze}
            disabled={!currentFrameBase64}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles size={16} />
            Analyze & Style
          </button>
        )}
      </div>

      {loading && (
        <div className="py-8 flex flex-col items-center justify-center text-zinc-500 gap-3">
          <Loader2 className="animate-spin text-indigo-500" size={24} />
          <p className="text-xs">Analyzing visual textures & mood...</p>
        </div>
      )}

      {result && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
          <div className="p-4 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
            <p className="text-zinc-300 italic text-sm">"{result.caption}"</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-zinc-800/50 rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase font-bold tracking-wider">
                <Palette size={12} /> Mood Color
              </div>
              <div className="flex items-center gap-2">
                <div 
                  className="w-6 h-6 rounded-full shadow-lg border border-white/10"
                  style={{ backgroundColor: result.moodColor }}
                />
                <span className="text-sm font-mono text-zinc-200">{result.moodColor}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-800/50 rounded-lg flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400 uppercase font-bold tracking-wider">
                <Type size={12} /> Char Set
              </div>
              <div className="font-mono text-xs tracking-[0.2em] text-zinc-200 truncate" title={result.recommendedChars}>
                {result.recommendedChars}
              </div>
            </div>
          </div>
          
          <button 
             onClick={handleAnalyze}
             className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800 mt-2"
          >
            Try Another Analysis
          </button>
        </div>
      )}
    </div>
  );
};

export default GeminiPanel;

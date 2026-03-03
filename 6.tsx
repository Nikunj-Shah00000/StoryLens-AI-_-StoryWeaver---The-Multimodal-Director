import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  SparklesIcon, 
  PhotoIcon, 
  VideoCameraIcon,
  AdjustmentsHorizontalIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

interface DirectorConsoleProps {
  onStartStory: (prompt: string, settings: any) => void;
}

const DirectorConsole: React.FC<DirectorConsoleProps> = ({ onStartStory }) => {
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState({
    style: 'cinematic',
    tone: 'mysterious',
    includeVideo: true,
    pacing: 'balanced'
  });

  const styles = ['cinematic', 'anime', 'watercolor', 'cyberpunk', 'fantasy'];
  const tones = ['mysterious', 'whimsical', 'epic', 'melancholic', 'suspenseful'];
  const pacings = ['slow', 'balanced', 'fast'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onStartStory(prompt, settings);
    }
  };

  return (
    <motion.div
      className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-6 shadow-2xl"
      whileHover={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)' }}
    >
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
        <SparklesIcon className="w-6 h-6 mr-2 text-purple-400" />
        Director's Console
      </h2>

      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-purple-200 mb-2 text-sm">Your Vision</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the story you want to tell..."
            className="w-full h-32 bg-slate-900/50 border border-purple-500/30 rounded-xl p-4 text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-400 transition-colors"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-purple-200 mb-2 text-sm flex items-center">
              <PhotoIcon className="w-4 h-4 mr-1" />
              Visual Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {styles.map((s) => (
                <motion.button
                  key={s}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSettings({ ...settings, style: s })}
                  className={`px-3 py-2 rounded-lg capitalize text-sm ${
                    settings.style === s
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                  }`}
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-purple-200 mb-2 text-sm flex items-center">
              <ChatBubbleLeftRightIcon className="w-4 h-4 mr-1" />
              Narrative Tone
            </label>
            <div className="grid grid-cols-2 gap-2">
              {tones.map((t) => (
                <motion.button
                  key={t}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSettings({ ...settings, tone: t })}
                  className={`px-3 py-2 rounded-lg capitalize text-sm ${
                    settings.tone === t
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                  }`}
                >
                  {t}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-purple-200 mb-2 text-sm flex items-center">
              <AdjustmentsHorizontalIcon className="w-4 h-4 mr-1" />
              Pacing
            </label>
            <div className="grid grid-cols-3 gap-2">
              {pacings.map((p) => (
                <motion.button
                  key={p}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSettings({ ...settings, pacing: p })}
                  className={`px-3 py-2 rounded-lg capitalize text-sm ${
                    settings.pacing === p
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-slate-700 text-purple-200 hover:bg-slate-600'
                  }`}
                >
                  {p}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-purple-200 text-sm flex items-center">
              <VideoCameraIcon className="w-4 h-4 mr-1" />
              Include Video
            </span>
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setSettings({ ...settings, includeVideo: !settings.includeVideo })}
              className={`w-12 h-6 rounded-full p-1 ${
                settings.includeVideo ? 'bg-purple-500' : 'bg-slate-600'
              }`}
            >
              <motion.div
                className="w-4 h-4 bg-white rounded-full"
                animate={{ x: settings.includeVideo ? 24 : 0 }}
              />
            </motion.button>
          </div>
        </div>

        <motion.button
          type="submit"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-purple-500/50 transition-shadow"
        >
          Start Directing
        </motion.button>
      </form>
    </motion.div>
  );
};

export default DirectorConsole;
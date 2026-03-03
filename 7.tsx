import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useInView } from 'react-intersection-observer';
import useStoryStore from '../store/storyStore';
import Image from 'next/image';

interface StoryFlowProps {
  sessionId: string | null;
  isConnected: boolean;
}

const StoryFlow: React.FC<StoryFlowProps> = ({ sessionId, isConnected }) => {
  const { storyChunks, assets } = useStoryStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [ref, inView] = useInView();

  useEffect(() => {
    // Auto-scroll to bottom when new chunks arrive
    if (inView) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [storyChunks, inView]);

  const renderContent = (chunk: any) => {
    if (chunk.type === 'text_chunk') {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-invert max-w-none"
        >
          <ReactMarkdown>{chunk.content}</ReactMarkdown>
        </motion.div>
      );
    }

    if (chunk.type === 'image_ready') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="my-4 rounded-xl overflow-hidden shadow-2xl"
        >
          <Image
            src={chunk.url}
            alt={chunk.prompt}
            width={800}
            height={450}
            className="w-full h-auto"
          />
          <p className="text-sm text-purple-300 mt-2 italic">"{chunk.prompt}"</p>
        </motion.div>
      );
    }

    if (chunk.type === 'video_ready') {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="my-4 rounded-xl overflow-hidden shadow-2xl"
        >
          <video
            src={chunk.url}
            controls
            autoPlay
            loop
            muted
            className="w-full h-auto"
          />
          <p className="text-sm text-purple-300 mt-2 italic">"{chunk.prompt}"</p>
        </motion.div>
      );
    }

    if (chunk.type?.startsWith('image_generating')) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="my-4 p-8 bg-slate-800/50 rounded-xl border border-purple-500/30"
        >
          <div className="flex items-center space-x-4">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-purple-300">Painting with light...</p>
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-6 h-[600px] overflow-y-auto">
      {!isConnected && sessionId && (
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-purple-300">Connecting to the creative realm...</p>
        </div>
      )}

      {isConnected && storyChunks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-purple-300 text-lg">Your story will appear here...</p>
          <p className="text-purple-400/60 text-sm mt-2">Adjust your director's console and begin</p>
        </div>
      )}

      <div className="space-y-6">
        <AnimatePresence>
          {storyChunks.map((chunk, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-l-2 border-purple-500 pl-4"
            >
              {renderContent(chunk)}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div ref={ref} className="h-1" />
    </div>
  );
};

export default StoryFlow;
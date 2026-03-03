import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Head from 'next/head';
import DirectorConsole from '../components/DirectorConsole';
import StoryFlow from '../components/StoryFlow';
import ControlPanel from '../components/ControlPanel';
import useStoryStore from '../store/storyStore';
import { generateUUID } from '../utils/helpers';

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { startStory, isLoading, error } = useStoryStore();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Generate session ID on mount
    setSessionId(generateUUID());
  }, []);

  const handleStartStory = async (prompt: string, settings: any) => {
    if (!sessionId) return;

    try {
      // Initialize story session
      const response = await fetch('/api/story/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          session_id: sessionId,
          ...settings
        })
      });

      if (!response.ok) throw new Error('Failed to start story');

      // Connect WebSocket for real-time streaming
      const ws = new WebSocket(`ws://localhost:8080/ws/story/${sessionId}`);
      
      ws.onopen = () => {
        setIsConnected(true);
        startStory(sessionId, prompt, settings);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        useStoryStore.getState().addStreamChunk(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        useStoryStore.getState().setError('Connection lost');
      };

      wsRef.current = ws;

    } catch (err) {
      useStoryStore.getState().setError(err.message);
    }
  };

  return (
    <>
      <Head>
        <title>StoryWeaver - The Multimodal Director</title>
        <meta name="description" content="AI-powered creative direction for multimedia storytelling" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Animated background */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 180],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-conic from-purple-500/30 via-pink-500/30 to-purple-500/30 blur-3xl"
          />
        </div>

        {/* Main content */}
        <div className="relative z-10 container mx-auto px-4 py-8">
          <motion.header
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="text-center mb-12"
          >
            <h1 className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 mb-4">
              StoryWeaver
            </h1>
            <p className="text-xl text-purple-200/80 max-w-2xl mx-auto">
              Your AI Creative Director — weave text, images, and video into immersive narratives
            </p>
          </motion.header>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Panel - Director's Console */}
            <motion.div
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-1"
            >
              <DirectorConsole onStartStory={handleStartStory} />
            </motion.div>

            {/* Main Panel - Story Flow */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2"
            >
              <StoryFlow sessionId={sessionId} isConnected={isConnected} />
            </motion.div>

            {/* Right Panel - Controls */}
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-1"
            >
              <ControlPanel sessionId={sessionId} />
            </motion.div>
          </div>

          {/* Loading overlay */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
              >
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl text-center">
                  <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-white text-lg">Weaving your story...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error toast */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-8 right-8 bg-red-500 text-white px-6 py-4 rounded-xl shadow-xl"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  );
}
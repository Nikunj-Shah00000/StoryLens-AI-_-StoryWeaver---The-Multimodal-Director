import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface StoryChunk {
  type: string;
  content?: string;
  url?: string;
  prompt?: string;
  placeholder_id?: string;
  timestamp: string;
}

interface Asset {
  id: string;
  type: 'image' | 'video';
  url: string;
  prompt: string;
  timestamp: string;
}

interface StoryState {
  sessionId: string | null;
  storyChunks: StoryChunk[];
  assets: Asset[];
  isLoading: boolean;
  error: string | null;
  
  startStory: (sessionId: string, prompt: string, settings: any) => void;
  addStreamChunk: (chunk: StoryChunk) => void;
  setError: (error: string) => void;
  regenerateAsset: (assetId: string) => void;
  clearStory: () => void;
}

const useStoryStore = create<StoryState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      storyChunks: [],
      assets: [],
      isLoading: false,
      error: null,

      startStory: (sessionId, prompt, settings) => {
        set({
          sessionId,
          storyChunks: [],
          assets: [],
          isLoading: true,
          error: null
        });
      },

      addStreamChunk: (chunk) => {
        const { storyChunks, assets } = get();
        
        // Update chunks
        set({ storyChunks: [...storyChunks, chunk] });

        // If it's a completed asset, add to assets list
        if (chunk.type === 'image_ready' || chunk.type === 'video_ready') {
          const newAsset: Asset = {
            id: `${Date.now()}-${Math.random()}`,
            type: chunk.type === 'image_ready' ? 'image' : 'video',
            url: chunk.url!,
            prompt: chunk.prompt!,
            timestamp: chunk.timestamp
          };
          set({ assets: [...assets, newAsset] });
        }

        // Turn off loading when we get first content
        if (storyChunks.length === 0) {
          set({ isLoading: false });
        }
      },

      setError: (error) => set({ error, isLoading: false }),

      regenerateAsset: (assetId) => {
        // Implementation for regenerating specific asset
        console.log('Regenerate asset:', assetId);
      },

      clearStory: () => {
        set({
          sessionId: null,
          storyChunks: [],
          assets: [],
          isLoading: false,
          error: null
        });
      }
    }),
    {
      name: 'storyweaver-storage',
      partialize: (state) => ({
        // Only persist these fields
        storyChunks: state.storyChunks,
        assets: state.assets
      })
    }
  )
);

export default useStoryStore;
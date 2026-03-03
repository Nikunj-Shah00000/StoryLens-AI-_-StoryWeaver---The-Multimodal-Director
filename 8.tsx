import React from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowPathIcon, 
  CloudArrowDownIcon,
  ShareIcon,
  HeartIcon
} from '@heroicons/react/24/outline';
import useStoryStore from '../store/storyStore';

interface ControlPanelProps {
  sessionId: string | null;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ sessionId }) => {
  const { assets, regenerateAsset } = useStoryStore();

  const handleRegenerate = (assetId: string) => {
    regenerateAsset(assetId);
  };

  const handleDownload = (url: string, type: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `storyweaver-${Date.now()}.${type === 'video' ? 'mp4' : 'png'}`;
    a.click();
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-6">
      <h3 className="text-xl font-bold text-white mb-4">Generated Assets</h3>
      
      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        {assets.map((asset) => (
          <motion.div
            key={asset.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-700/50 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-300 capitalize">
                {asset.type}
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleRegenerate(asset.id)}
                  className="p-1 hover:bg-slate-600 rounded transition-colors"
                >
                  <ArrowPathIcon className="w-4 h-4 text-purple-300" />
                </button>
                <button
                  onClick={() => handleDownload(asset.url, asset.type)}
                  className="p-1 hover:bg-slate-600 rounded transition-colors"
                >
                  <CloudArrowDownIcon className="w-4 h-4 text-purple-300" />
                </button>
                <button className="p-1 hover:bg-slate-600 rounded transition-colors">
                  <ShareIcon className="w-4 h-4 text-purple-300" />
                </button>
                <button className="p-1 hover:bg-slate-600 rounded transition-colors">
                  <HeartIcon className="w-4 h-4 text-purple-300" />
                </button>
              </div>
            </div>
            <p className="text-xs text-purple-400/70 truncate">{asset.prompt}</p>
          </motion.div>
        ))}

        {assets.length === 0 && (
          <div className="text-center py-8">
            <p className="text-purple-300/60">No assets generated yet</p>
            <p className="text-xs text-purple-400/40 mt-1">
              Images and videos will appear here as they're created
            </p>
          </div>
        )}
      </div>

      {sessionId && (
        <div className="mt-4 pt-4 border-t border-purple-500/30">
          <div className="text-xs text-purple-300/60">
            Session ID: <span className="font-mono">{sessionId.slice(0, 8)}...</span>
          </div>
          <div className="flex items-center mt-2">
            <div className={`w-2 h-2 rounded-full ${sessionId ? 'bg-green-400' : 'bg-red-400'} mr-2`} />
            <span className="text-xs text-purple-300/60">
              {sessionId ? 'Connected to creative realm' : 'Disconnected'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControlPanel;
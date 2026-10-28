import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wind, RefreshCw, AlertCircle, PlayCircle, Clock } from 'lucide-react';

interface PageLoaderProps {
  elapsedSeconds: number;
  error: string | null;
  isConnectionError: boolean;
  onRetry: () => void;
  onEnableDemo: () => void;
}

const STATUS_MESSAGES = [
  'Connecting to backend API...',
  'Fetching wind generation forecasts from Elexon BMRS...',
  'Retrieving FUELHH actual wind outturn...',
  'Applying Day-Ahead decision cutoffs...',
  'Calculating MAE, RMSE, MBE & MAPE metrics...',
  'Preparing your procurement dashboard...',
];

export const PageLoader: React.FC<PageLoaderProps> = ({
  elapsedSeconds,
  error,
  isConnectionError,
  onRetry,
  onEnableDemo,
}) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const isTakingLong = elapsedSeconds > 8;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/95 backdrop-blur-xl px-4"
    >
      {/* Background ambient lighting */}
      <div className="absolute w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -top-10 -left-10 animate-pulse-slow" />
      <div className="absolute w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -bottom-10 -right-10 animate-pulse-slow" />

      <div className="relative z-10 max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
        {/* Animated Turbine Logo */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-50 to-sky-100 border border-blue-200 flex items-center justify-center shadow-md">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
            >
              <Wind className="w-10 h-10 text-blue-600" />
            </motion.div>
          </div>
          {/* Subtle spinning ring */}
          <motion.div
            className="absolute -inset-2 rounded-2xl border border-blue-400/30 border-dashed"
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
          />
        </div>

        {/* Brand Name */}
        <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">
          Wind <span className="text-blue-600">Intelligence</span>
        </h1>
        <p className="text-xs text-slate-500 mb-6 font-mono">
          UK National Wind Forecast Analysis · January 2026
        </p>

        {error ? (
          <div className="w-full">
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs mb-6 text-left flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900 mb-1">Backend Connection Issue</p>
                <p className="text-slate-600 leading-relaxed">{error}</p>
                {isConnectionError && (
                  <p className="text-[11px] text-slate-500 mt-2 font-mono">
                    Target: {import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center w-full">
              <button
                onClick={onRetry}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry Connection</span>
              </button>

              <button
                onClick={onEnableDemo}
                className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-blue-700 border border-slate-200 text-sm transition-all font-medium"
              >
                <PlayCircle className="w-4 h-4 text-blue-600" />
                <span>Explore with Demo Data</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {/* Smooth progress line */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-4 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 to-sky-500 rounded-full"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.8,
                  ease: 'easeInOut',
                }}
                style={{ width: '60%' }}
              />
            </div>

            {/* Rotating message */}
            <div className="h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs text-slate-700 font-medium"
                >
                  {STATUS_MESSAGES[messageIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Elapsed Time indicator */}
            <div className="mt-4 flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Elapsed: {elapsedSeconds}s</span>
            </div>

            {isTakingLong && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-5 pt-4 border-t border-slate-100 w-full"
              >
                <p className="text-[11px] text-amber-700 mb-3">
                  Querying national wind generation datasets from Elexon...
                </p>
                <button
                  onClick={onEnableDemo}
                  className="inline-flex items-center space-x-1.5 text-xs text-blue-600 hover:text-blue-500 underline font-medium"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Preview with Demo Data instead</span>
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

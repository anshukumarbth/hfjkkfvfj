import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LucideIcon, HelpCircle } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  unit?: string;
  subValue?: string;
  icon: LucideIcon;
  tooltipText: string;
  accentColor: 'cyan' | 'electric' | 'emerald' | 'amber' | 'rose';
  delayIndex?: number;
}

const ACCENT_STYLES = {
  cyan: {
    border: 'border-slate-200 hover:border-sky-300',
    iconBg: 'bg-sky-50 text-sky-600 border border-sky-100',
    valueColor: 'text-slate-900',
  },
  electric: {
    border: 'border-slate-200 hover:border-blue-300',
    iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
    valueColor: 'text-slate-900',
  },
  emerald: {
    border: 'border-slate-200 hover:border-emerald-300',
    iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    valueColor: 'text-slate-900',
  },
  amber: {
    border: 'border-slate-200 hover:border-amber-300',
    iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
    valueColor: 'text-slate-900',
  },
  rose: {
    border: 'border-slate-200 hover:border-rose-300',
    iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
    valueColor: 'text-slate-900',
  },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  subValue,
  icon: Icon,
  tooltipText,
  accentColor,
  delayIndex = 0,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const styles = ACCENT_STYLES[accentColor];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delayIndex * 0.08 }}
      className={`glass-panel p-5 relative group transition-all duration-300 bg-white shadow-sm hover:shadow-md ${styles.border}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline space-x-1.5 mb-1.5">
        <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${styles.valueColor}`}>
          {value}
        </span>
        {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
      </div>

      {/* Footer & Tooltip */}
      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-100 text-slate-500">
        <span className="truncate text-[11px]">{subValue || 'Wholesale market metric'}</span>

        {/* Tooltip */}
        <div className="relative ml-2">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            aria-label={`More info on ${title}`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>

          {showTooltip && (
            <div className="absolute bottom-full right-0 mb-2 w-56 p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 shadow-xl z-30 leading-relaxed font-normal">
              {tooltipText}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

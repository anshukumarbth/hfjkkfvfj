import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Database,
  Settings,
  Wind,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'forecast-chart', label: 'Forecast Analysis', icon: TrendingUp },
  { id: 'accuracy-metrics', label: 'Accuracy Metrics', icon: BarChart3 },
  { id: 'data-explorer', label: 'Data Explorer', icon: Database },
  { id: 'settings', label: 'Settings & Cutoffs', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleItemClick = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Hamburger Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-blue-600 text-white shadow-lg focus:outline-none"
        aria-label="Toggle navigation menu"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside
        animate={{
          width: isCollapsed ? '5rem' : '16rem',
        }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className={`fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-slate-200/90 shadow-sm flex flex-col justify-between transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0 !w-72' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand Logo & Name */}
          <div className="h-16 flex items-center px-4 border-b border-slate-100 justify-between">
            <div className="flex items-center space-x-3 overflow-hidden cursor-pointer" onClick={() => handleItemClick('dashboard')}>
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                <Wind className="w-5 h-5 text-blue-600" />
              </div>
              {(!isCollapsed || mobileOpen) && (
                <div className="overflow-hidden whitespace-nowrap">
                  <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-1">
                    <span>Wind</span>
                    <span className="text-blue-600">Intelligence</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                    Elexon BMRS Analytics
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5 mt-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200/70 shadow-sm font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                  {(!isCollapsed || mobileOpen) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Market Badge Bottom Card */}
        {(!isCollapsed || mobileOpen) && (
          <div className="p-4 border-t border-slate-100">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-2.5">
              <Zap className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <p className="text-slate-800 font-semibold">GB Wholesale Market</p>
                <p className="text-slate-500">Day-Ahead Auction evaluation for January 2026 delivery.</p>
              </div>
            </div>
          </div>
        )}
      </motion.aside>
    </>
  );
};

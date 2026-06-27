import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

export const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleReady = (e: any) => {
      setDeferredPrompt(e.detail);
      setShow(true);
    };
    const handleInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('pwa-install-ready', handleReady);
    window.addEventListener('pwa-installed', handleInstalled);
    return () => {
      window.removeEventListener('pwa-install-ready', handleReady);
      window.removeEventListener('pwa-installed', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'accepted') {
      console.log('User accepted PWA install');
    }
    setDeferredPrompt(null);
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[200] w-[90vw] max-w-md"
        >
          <div className="bg-slate-900/95 backdrop-blur-2xl border border-emerald-500/20 rounded-2xl p-4 shadow-2xl shadow-emerald-900/30 flex items-center gap-4">
            <div className="bg-emerald-600/20 p-2.5 rounded-xl shrink-0">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-200">Install virelChat</p>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Add to home screen for the best experience
              </p>
            </div>
            <button
              onClick={handleInstall}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shrink-0"
            >
              Install
            </button>
            <button
              onClick={() => setShow(false)}
              className="p-2 text-slate-600 hover:text-slate-400 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

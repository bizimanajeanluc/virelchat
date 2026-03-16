import { motion } from "motion/react";
import { MessageSquare, Zap, Users, Shield, ArrowRight, ShieldCheck, Lock, Globe } from "lucide-react";

interface LandingProps {
  onGetStarted: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted }) => {
  return (
    <div className="h-screen w-full bg-[#020617] font-sans text-slate-100 overflow-y-auto overflow-x-hidden select-none scroll-smooth">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-900/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-900/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <MessageSquare className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter text-white uppercase">virelChat</span>
          </div>
          <div className="flex items-center gap-4 md:gap-10">
            <a href="#features" className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-emerald-400 transition-colors">Features</a>
            <button onClick={onGetStarted} className="bg-emerald-600 text-white px-5 md:px-8 py-2 md:py-3 rounded-full hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40 active:scale-95 text-[10px] font-black uppercase tracking-widest">Establish Link</button>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero */}
        <section className="pt-16 md:pt-32 pb-20 md:pb-32 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-4xl mx-auto">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                <div className="inline-flex items-center gap-2 py-2 px-4 rounded-full bg-emerald-950/30 text-emerald-400 text-[8px] md:text-[10px] font-black uppercase tracking-widest mb-6 md:mb-10 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  Signal Protocol v3 • End-to-End Encrypted
                </div>
                <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter mb-6 md:mb-10 leading-[0.95] text-white uppercase">
                  Private <span className="text-emerald-500">Comm</span> Channels.
                </h1>
                <p className="text-base md:text-xl text-slate-400 mb-8 md:mb-14 leading-relaxed max-w-2xl mx-auto font-medium px-4">
                  High-fidelity secure communication for ward communities. Zero trackers. Zero data collection.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 px-4">
                  <button onClick={onGetStarted} className="w-full sm:w-auto bg-emerald-600 text-white px-10 md:px-14 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-900/50 text-[11px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95">Initiate Session <ArrowRight className="w-4 h-4" /></button>
                  <button className="w-full sm:w-auto bg-white/5 border border-white/10 text-slate-300 px-10 md:px-14 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black hover:bg-white/10 transition-all text-[11px] md:text-xs uppercase tracking-[0.2em]">Protocol Specs</button>
                </div>
              </motion.div>
            </div>

            {/* Preview Mockup */}
            <motion.div initial={{ opacity: 0, scale: 0.98, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.3, duration: 1 }} className="mt-16 md:mt-24 relative px-2">
              <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent z-10 pointer-events-none" />
              <div className="rounded-3xl md:rounded-[3rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)] overflow-hidden bg-slate-950 aspect-[4/3] md:aspect-[21/9] flex">
                <div className="w-1/4 lg:w-72 border-r border-white/5 hidden md:block p-4 lg:p-6 bg-slate-900/30">
                  <div className="space-y-4 md:space-y-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3 md:gap-4 opacity-30">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-slate-800" />
                        <div className="flex-1 space-y-2 hidden lg:block">
                          <div className="h-2 w-24 bg-slate-800 rounded-full" />
                          <div className="h-1.5 w-16 bg-slate-800/50 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-6 md:p-10 flex flex-col bg-slate-900/10">
                  <div className="flex-1 space-y-6 md:space-y-8">
                    <div className="flex justify-start">
                      <div className="bg-slate-800/50 backdrop-blur-md p-4 md:p-5 rounded-2xl md:rounded-[2rem] rounded-tl-none max-w-[85%] md:max-w-sm border border-white/5 shadow-xl">
                        <div className="h-2 md:h-2.5 w-24 md:w-48 bg-slate-700 rounded-full mb-2 md:mb-3" />
                        <div className="h-1.5 md:h-2 w-16 md:w-32 bg-slate-700/50 rounded-full" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-emerald-600 p-4 md:p-5 rounded-2xl md:rounded-[2rem] rounded-tr-none max-w-[85%] md:max-w-sm shadow-2xl shadow-emerald-900/20">
                        <div className="h-2 md:h-2.5 w-20 md:w-40 bg-emerald-400/50 rounded-full mb-2 md:mb-3" />
                        <div className="h-1.5 md:h-2 w-12 md:w-24 bg-emerald-400/30 rounded-full" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-6 md:pt-10 border-t border-white/5 flex gap-4 md:gap-6">
                    <div className="flex-1 h-12 md:h-14 bg-white/5 rounded-xl md:rounded-2xl border border-white/10" />
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-600 rounded-xl md:rounded-2xl shadow-lg shadow-emerald-900/40" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 md:py-32 bg-slate-950/20 px-4 sm:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
              <div className="space-y-6 text-center md:text-left group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-amber-950/30 rounded-2xl flex items-center justify-center mx-auto md:mx-0 border border-amber-500/20 group-hover:bg-amber-500 transition-all duration-500">
                  <Zap className="text-amber-500 w-7 h-7 md:w-8 md:h-8 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Zero Latency</h3>
                <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">Socket-level optimization ensures sub-100ms packet delivery across secure nodes.</p>
              </div>
              <div className="space-y-6 text-center md:text-left group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-950/30 rounded-2xl flex items-center justify-center mx-auto md:mx-0 border border-emerald-500/20 group-hover:bg-emerald-500 transition-all duration-500">
                  <Lock className="text-emerald-500 w-7 h-7 md:w-8 md:h-8 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Hardened Core</h3>
                <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">Identity keys remain on-device. Signal Protocol double-ratchet logic protects every bit.</p>
              </div>
              <div className="space-y-6 text-center md:text-left group">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-blue-950/30 rounded-2xl flex items-center justify-center mx-auto md:mx-0 border border-blue-500/20 group-hover:bg-blue-500 transition-all duration-500">
                  <Globe className="text-blue-500 w-7 h-7 md:w-8 md:h-8 group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">Local Nodes</h3>
                <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed">Verified ward-level access ensures a trusted ecosystem for private family groups.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/5 py-16 md:py-20 text-slate-500 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-black text-white uppercase tracking-tighter">virelChat</span>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center md:text-left">© 2026 virelChat Security • Pure Encrypted Transmission.</p>
          <div className="flex gap-6 md:gap-8 text-[9px] font-black uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Protocol</a>
            <a href="#" className="hover:text-white transition-colors">Network</a>
            <a href="#" className="hover:text-white transition-colors">Nodes</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

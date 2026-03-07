import { motion } from "motion/react";
import { MessageSquare, Zap, Users, Shield } from "lucide-react";

interface LandingProps {
  onGetStarted: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 overflow-y-auto">
      {/* Navigation */}
      <nav className="border-b border-stone-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-emerald-600">virelChat</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600">
            <a href="#features" className="hover:text-emerald-600 transition-colors">Features</a>
            <a href="#security" className="hover:text-emerald-600 transition-colors">Security</a>
            <button 
              onClick={onGetStarted}
              className="bg-emerald-600 text-white px-4 py-2 rounded-full hover:bg-emerald-700 transition-all shadow-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <section className="pt-20 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-block py-1 px-3 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-4">
                  Secure & Private
                </span>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
                  Chatting made vibrant and viral.
                </h1>
                <p className="text-lg text-stone-600 mb-10 leading-relaxed">
                  Connect with anyone, anywhere, in real-time. virelChat brings high-fidelity messaging, secure encryption, and viral social features to your fingertips.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button 
                    onClick={onGetStarted}
                    className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 text-lg"
                  >
                    Start Chatting Free
                  </button>
                  <button className="w-full sm:w-auto bg-white border border-stone-200 text-stone-700 px-8 py-4 rounded-2xl font-semibold hover:bg-stone-50 transition-all text-lg">
                    Watch Demo
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Mockup Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="mt-20 relative"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent z-10" />
              <div className="rounded-3xl border border-stone-200 shadow-2xl overflow-hidden bg-white aspect-video md:aspect-[21/9] flex">
                <div className="w-64 border-r border-stone-100 hidden md:block p-4 bg-slate-50/50">
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-2 w-20 bg-slate-200 rounded" />
                          <div className="h-2 w-12 bg-slate-100 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-1 p-6 flex flex-col">
                  <div className="flex-1 space-y-6">
                    <div className="flex justify-start">
                      <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none max-w-xs">
                        <div className="h-2 w-32 bg-slate-200 rounded mb-2" />
                        <div className="h-2 w-24 bg-slate-200 rounded" />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-emerald-600 p-4 rounded-2xl rounded-tr-none max-w-xs">
                        <div className="h-2 w-32 bg-emerald-400 rounded mb-2" />
                        <div className="h-2 w-24 bg-emerald-400 rounded" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-6 border-t border-slate-100 flex gap-4">
                    <div className="flex-1 h-12 bg-slate-50 rounded-xl border border-slate-200" />
                    <div className="w-12 h-12 bg-emerald-600 rounded-xl" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Zap className="text-amber-600 w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Lightning Fast</h3>
                <p className="text-slate-600">Real-time message delivery with end-to-end encryption. Built for speed and reliability.</p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Shield className="text-emerald-600 w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">End-to-End Secure</h3>
                <p className="text-slate-600">Your privacy is our priority. Built on the Signal Protocol, every message is encrypted before it leaves your device.</p>
              </div>
              <div className="space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Users className="text-emerald-600 w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Ward-Based Communities</h3>
                <p className="text-slate-600">Connect securely within your local community or ward, ensuring safe and trusted communication.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
              <MessageSquare className="text-white w-4 h-4" />
            </div>
            <span className="text-lg font-bold text-white">virelChat</span>
          </div>
          <p className="text-sm">© 2026 virelChat. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { signIn, signUp } from '../services/auth';
import { Button } from '../components/ui/Button';
import { AlertCircle, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        if (isLogin) {
          // Should not happen if auto-confirm is on, but just in case
        } else {
          setMessage("Account created successfully!");
          setIsLogin(true); // Switch to login view
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-20%] w-[500px] h-[500px] bg-primary-200/40 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 bg-pink-200/40 rounded-full blur-[80px]"></div>
      </div>

      <div className="w-full max-w-sm z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-white rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-200 rotate-3 transition-transform hover:rotate-0 duration-500">
            <Zap size={36} className="text-primary-600 fill-primary-600" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">SnapCal AI</h1>
          <p className="text-gray-500 font-medium">Track your vibe, not just calories.</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl border border-white p-8 rounded-[40px] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)]">
          <div className="flex p-1 bg-gray-100 rounded-[20px] mb-8">
            <button
              onClick={() => { setIsLogin(true); setError(null); setMessage(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-[16px] transition-all duration-300 ${isLogin ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(null); setMessage(null); }}
              className={`flex-1 py-3 text-sm font-bold rounded-[16px] transition-all duration-300 ${!isLogin ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            {message && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm font-medium animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 size={18} />
                {message}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 text-gray-900 transition-all placeholder:text-gray-400 font-medium"
                  placeholder="hello@snapcal.ai"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 text-gray-900 transition-all placeholder:text-gray-400 font-medium"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <Button className="w-full mt-4 flex justify-between items-center group py-5" isLoading={isLoading}>
              <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
              {!isLoading && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-400 text-xs mt-8 font-medium">
          {isLogin ? "New here? Create an account above." : "Welcome back. Sign in above."}
        </p>
      </div>
    </div>
  );
};
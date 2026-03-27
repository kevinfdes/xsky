import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const Auth = () => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '', display_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.username || !form.email || !form.password || !form.display_name) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        if (form.username.length < 3) {
          setError('Username must be at least 3 characters');
          setLoading(false);
          return;
        }
        await register(form.username, form.email, form.password, form.display_name);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FCFBF4] dark:bg-[#0F0F0F]">
      {/* Left Hero Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #A3E6D0 0%, #E1D4F9 50%, #FAD9A6 100%)' }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#111111] rounded-xl flex items-center justify-center font-['Outfit'] font-black text-[#A3E6D0] text-xl neo-shadow">
              A
            </div>
            <span className="font-['Outfit',sans-serif] font-bold text-2xl text-[#111111]">Agora</span>
          </div>
        </div>

        <div className="relative z-10">
          <h1 className="font-['Outfit',sans-serif] font-bold text-4xl sm:text-5xl text-[#111111] leading-tight mb-4">
            The public square,<br />reimagined.
          </h1>
          <p className="text-[#555555] text-lg font-['Figtree'] leading-relaxed">
            A kinder, cleaner social experience. Share ideas, connect with people, and build community without the noise.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            {[
              { emoji: '✦', text: 'Chronological & curated feeds' },
              { emoji: '✦', text: 'Meaningful conversations, not hot takes' },
              { emoji: '✦', text: 'Your data, your control' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-[#111111] font-bold text-sm">{f.emoji}</span>
                <span className="text-[#111111] font-medium text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative shapes */}
        <div className="absolute top-20 right-10 w-40 h-40 bg-[#BDE0FE]/50 rounded-3xl border-2 border-[#111111]/20 rotate-12 neo-shadow" />
        <div className="absolute bottom-32 right-20 w-24 h-24 bg-[#FAD9A6]/80 rounded-2xl border-2 border-[#111111]/20 -rotate-6" />
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-[#A3E6D0] rounded-xl border border-[#111111] neo-shadow-sm flex items-center justify-center font-['Outfit'] font-black text-[#111111] text-lg">
              A
            </div>
            <span className="font-['Outfit',sans-serif] font-bold text-xl text-[#111111] dark:text-[#F5F5F5]">Agora</span>
          </div>

          <h2 className="font-['Outfit',sans-serif] font-bold text-2xl text-[#111111] dark:text-[#F5F5F5] mb-1">
            {mode === 'login' ? 'Welcome back' : 'Join Agora'}
          </h2>
          <p className="text-sm text-[#555555] dark:text-[#A0A0A0] mb-7">
            {mode === 'login' ? 'Sign in to your account' : 'Create your free account'}
          </p>

          {/* Toggle */}
          <div className="flex rounded-xl border border-[#111111]/10 dark:border-[#333333] overflow-hidden mb-6 bg-[#111111]/5 dark:bg-[#F5F5F5]/5 p-1 gap-1">
            {['login', 'register'].map(m => (
              <button
                key={m}
                data-testid={`auth-tab-${m}`}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                  mode === m
                    ? 'bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] border border-[#111111]/20 neo-shadow-sm'
                    : 'text-[#555555] dark:text-[#A0A0A0] hover:text-[#111111] dark:hover:text-[#F5F5F5]'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
                    Display Name
                  </label>
                  <input
                    data-testid="register-display-name"
                    name="display_name"
                    value={form.display_name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/50 dark:placeholder-[#A0A0A0]/50 focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
                    Username
                  </label>
                  <input
                    data-testid="register-username"
                    name="username"
                    value={form.username}
                    onChange={handleChange}
                    placeholder="@username"
                    className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/50 dark:placeholder-[#A0A0A0]/50 focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] transition-colors"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                data-testid="auth-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/50 dark:placeholder-[#A0A0A0]/50 focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                data-testid="auth-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-[#111111]/20 dark:border-[#333333] rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/50 dark:placeholder-[#A0A0A0]/50 focus:outline-none focus:border-[#A3E6D0] dark:focus:border-[#85D4B9] transition-colors"
              />
            </div>

            {error && (
              <div
                data-testid="auth-error"
                className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </div>
            )}

            <button
              data-testid="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#111111] dark:bg-[#F5F5F5] hover:bg-[#333333] dark:hover:bg-[#E0E0E0] text-[#F5F5F5] dark:text-[#111111] font-['Outfit',sans-serif] font-semibold text-sm rounded-xl border border-[#111111] dark:border-[#F5F5F5] neo-shadow transition-all duration-150 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#555555] dark:text-[#A0A0A0]">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              data-testid={`switch-to-${mode === 'login' ? 'register' : 'login'}`}
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="font-semibold text-[#111111] dark:text-[#F5F5F5] hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

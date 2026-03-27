import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX_CHARS = 300;

const PostComposer = ({ onPost, replyTo = null, placeholder = "What's on your mind?" }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef(null);

  const remaining = MAX_CHARS - content.length;
  const isValid = content.trim().length > 0 && remaining >= 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    try {
      const payload = { content: content.trim(), reply_to: replyTo };
      const res = await axios.post(`${API}/posts`, payload);
      setContent('');
      if (onPost) onPost(res.data);
    } catch (err) {
      console.error('Post failed', err);
    } finally {
      setLoading(false);
    }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
    setContent(e.target.value);
  };

  if (!user) return null;

  return (
    <div
      data-testid="post-composer"
      className="flex gap-3 px-4 py-4 border-b border-[#111111]/10 dark:border-[#333333]"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-[#111111] dark:text-[#F5F5F5] overflow-hidden flex-shrink-0">
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          : user.display_name?.slice(0, 2).toUpperCase()
        }
      </div>

      <div className="flex-1">
        <textarea
          ref={textareaRef}
          data-testid="post-textarea"
          value={content}
          onChange={autoResize}
          placeholder={placeholder}
          rows={replyTo ? 2 : 3}
          className="w-full bg-transparent text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/60 dark:placeholder-[#A0A0A0]/60 resize-none focus:outline-none text-base font-['Figtree',sans-serif] leading-relaxed min-h-[60px]"
        />

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#111111]/10 dark:border-[#333333]">
          {/* Char count */}
          <div className="flex items-center gap-2">
            <div
              className={`text-xs font-medium ${
                remaining < 20 ? (remaining < 0 ? 'text-red-500' : 'text-[#FAD9A6] dark:text-[#EBBF7E]') : 'text-[#555555] dark:text-[#A0A0A0]'
              }`}
            >
              {remaining < 50 ? remaining : ''}
            </div>
            {remaining < 50 && (
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#111111]/10 dark:text-[#333333]" />
                <circle
                  cx="12" cy="12" r="9" fill="none" strokeWidth="2"
                  strokeDasharray={`${Math.max(0, ((MAX_CHARS - content.length) / MAX_CHARS)) * 56.5} 56.5`}
                  strokeLinecap="round"
                  stroke={remaining < 0 ? '#FF6B6B' : remaining < 20 ? '#FAD9A6' : '#A3E6D0'}
                  transform="rotate(-90 12 12)"
                />
              </svg>
            )}
          </div>

          {/* Submit */}
          <button
            data-testid="post-submit-btn"
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="px-5 py-2 bg-[#A3E6D0] hover:bg-[#8DD4BE] dark:bg-[#85D4B9] dark:hover:bg-[#A3E6D0] text-[#111111] font-['Outfit',sans-serif] font-semibold text-sm rounded-xl border border-[#111111] dark:border-transparent neo-shadow-sm transition-all duration-150 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0"
          >
            {loading ? '...' : replyTo ? 'Reply' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostComposer;

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, WarningCircle, X, Quotes, ThreadsLogo } from '@phosphor-icons/react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const MAX_CHARS = 500;

const PostComposer = ({ onPost, replyTo = null, quoteOf = null, quotedPost = null, placeholder = "What's on your mind?" }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState(['']); // Thread support: array of content strings
  const [loading, setLoading] = useState(false);
  const [contentWarning, setContentWarning] = useState(false);
  const [cwLabel, setCwLabel] = useState('');
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [mediaPreviews, setMediaPreviews] = useState([[]]); // per-post media
  const [mediaPaths, setMediaPaths] = useState([[]]); // actual paths
  const fileInputRef = useRef(null);
  const [activePostIdx, setActivePostIdx] = useState(0);
  const textRefs = useRef([]);

  const isThread = posts.length > 1;
  const allValid = posts.every(p => p.trim().length > 0 && p.length <= MAX_CHARS);

  const handleChange = (idx, value) => {
    const next = [...posts];
    next[idx] = value;
    setPosts(next);
    // auto-resize
    if (textRefs.current[idx]) {
      textRefs.current[idx].style.height = 'auto';
      textRefs.current[idx].style.height = textRefs.current[idx].scrollHeight + 'px';
    }
  };

  const addToThread = () => {
    setPosts([...posts, '']);
    setMediaPreviews([...mediaPreviews, []]);
    setMediaPaths([...mediaPaths, []]);
    setActivePostIdx(posts.length);
  };

  const removeThreadPost = (idx) => {
    if (posts.length === 1) return;
    setPosts(posts.filter((_, i) => i !== idx));
    setMediaPreviews(mediaPreviews.filter((_, i) => i !== idx));
    setMediaPaths(mediaPaths.filter((_, i) => i !== idx));
    if (activePostIdx >= posts.length - 1) setActivePostIdx(posts.length - 2);
  };

  const handleImageClick = (idx) => {
    setActivePostIdx(idx);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const idx = activePostIdx;
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const path = res.data.path;
      const previewUrl = URL.createObjectURL(file);
      const np = [...mediaPreviews];
      const nph = [...mediaPaths];
      np[idx] = [...(np[idx] || []), previewUrl];
      nph[idx] = [...(nph[idx] || []), path];
      setMediaPreviews(np);
      setMediaPaths(nph);
    } catch (err) {
      alert('Image upload failed. Please try again.');
    } finally {
      setUploadingIdx(null);
      e.target.value = '';
    }
  };

  const removeImage = (postIdx, imgIdx) => {
    const np = [...mediaPreviews];
    const nph = [...mediaPaths];
    np[postIdx] = np[postIdx].filter((_, i) => i !== imgIdx);
    nph[postIdx] = nph[postIdx].filter((_, i) => i !== imgIdx);
    setMediaPreviews(np);
    setMediaPaths(nph);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allValid || loading) return;
    setLoading(true);
    try {
      let threadId = null;
      let lastPost = null;
      for (let i = 0; i < posts.length; i++) {
        const payload = {
          content: posts[i].trim(),
          media_urls: (mediaPaths[i] || []).map(p => `${process.env.REACT_APP_BACKEND_URL}/api/files/${p}`),
          reply_to: i === 0 ? replyTo : (lastPost ? lastPost.id : null),
          quote_of: i === 0 ? (quoteOf || null) : null,
          content_warning: i === 0 ? contentWarning : false,
          content_warning_label: i === 0 ? cwLabel : '',
          thread_id: threadId,
        };
        const res = await axios.post(`${API}/posts`, payload);
        lastPost = res.data;
        if (i === 0 && posts.length > 1) {
          threadId = res.data.id;
          // Update the first post with thread_id
          await axios.put(`${API}/posts/${res.data.id}`, { content: posts[0].trim() });
        }
        if (onPost && i === posts.length - 1) onPost(res.data);
      }
      setPosts(['']);
      setMediaPreviews([[]]);
      setMediaPaths([[]]);
      setContentWarning(false);
      setCwLabel('');
    } catch (err) {
      console.error('Post failed', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div data-testid="post-composer" className="border-b border-[#111111]/10 dark:border-[#333333]">
      {/* Quote preview */}
      {quotedPost && (
        <div className="mx-4 mt-3 p-3 rounded-xl border border-[#111111]/20 dark:border-[#333333] bg-[#FCFBF4] dark:bg-[#0F0F0F]">
          <div className="flex items-center gap-1.5 mb-1">
            <Quotes size={12} className="text-[#555555] dark:text-[#A0A0A0]" />
            <span className="text-xs font-semibold text-[#555555] dark:text-[#A0A0A0]">
              {quotedPost.author?.display_name}
            </span>
          </div>
          <p className="text-xs text-[#111111] dark:text-[#F5F5F5] line-clamp-2">{quotedPost.content}</p>
        </div>
      )}

      {posts.map((content, idx) => {
        const remaining = MAX_CHARS - content.length;
        return (
          <div key={idx} className={`flex gap-3 px-4 py-4 ${idx > 0 ? 'border-t border-[#111111]/5 dark:border-[#333333]/50' : ''}`}>
            {/* Thread line */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-[#111111] dark:text-[#F5F5F5] overflow-hidden">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : user.display_name?.slice(0, 2).toUpperCase()
                }
              </div>
              {isThread && idx < posts.length - 1 && (
                <div className="w-0.5 flex-1 bg-[#111111]/10 dark:bg-[#333333] mt-1.5 min-h-[24px]" />
              )}
            </div>

            <div className="flex-1">
              <textarea
                ref={el => textRefs.current[idx] = el}
                data-testid={idx === 0 ? "post-textarea" : `thread-textarea-${idx}`}
                value={content}
                onChange={e => handleChange(idx, e.target.value)}
                placeholder={idx === 0 ? placeholder : 'Continue the thread...'}
                rows={idx === 0 && !replyTo ? 3 : 2}
                className="w-full bg-transparent text-[#111111] dark:text-[#F5F5F5] placeholder-[#555555]/60 dark:placeholder-[#A0A0A0]/60 resize-none focus:outline-none text-base font-['Figtree',sans-serif] leading-relaxed min-h-[52px]"
              />

              {/* Image previews */}
              {mediaPreviews[idx] && mediaPreviews[idx].length > 0 && (
                <div className={`mt-2 grid gap-1.5 rounded-xl overflow-hidden ${mediaPreviews[idx].length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {mediaPreviews[idx].map((url, imgIdx) => (
                    <div key={imgIdx} className="relative">
                      <img src={url} alt="" className="w-full h-36 object-cover rounded-lg" />
                      <button
                        onClick={() => removeImage(idx, imgIdx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Content warning input */}
              {idx === 0 && contentWarning && (
                <input
                  data-testid="cw-label-input"
                  value={cwLabel}
                  onChange={e => setCwLabel(e.target.value)}
                  placeholder="Content warning label (e.g. Sensitive content)"
                  className="mt-2 w-full px-3 py-2 bg-[#FAD9A6]/30 dark:bg-[#EBBF7E]/10 border border-[#FAD9A6] dark:border-[#EBBF7E]/40 rounded-xl text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none"
                />
              )}

              <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#111111]/10 dark:border-[#333333]">
                <div className="flex items-center gap-1">
                  {/* Image upload */}
                  <button
                    data-testid={idx === 0 ? "image-upload-btn" : `image-upload-btn-${idx}`}
                    onClick={() => handleImageClick(idx)}
                    disabled={uploadingIdx === idx}
                    className="p-2 rounded-lg text-[#555555] dark:text-[#A0A0A0] hover:text-[#A3E6D0] dark:hover:text-[#85D4B9] hover:bg-[#A3E6D0]/10 transition-all disabled:opacity-40"
                    title="Add image"
                  >
                    {uploadingIdx === idx
                      ? <div className="w-4 h-4 border-2 border-[#A3E6D0] border-t-transparent rounded-full animate-spin" />
                      : <Image size={18} />
                    }
                  </button>

                  {/* Content warning (first post only) */}
                  {idx === 0 && (
                    <button
                      data-testid="cw-toggle-btn"
                      onClick={() => setContentWarning(!contentWarning)}
                      className={`p-2 rounded-lg transition-all ${contentWarning ? 'text-[#FAD9A6] dark:text-[#EBBF7E] bg-[#FAD9A6]/20' : 'text-[#555555] dark:text-[#A0A0A0] hover:text-[#FAD9A6] dark:hover:text-[#EBBF7E] hover:bg-[#FAD9A6]/10'}`}
                      title="Content warning"
                    >
                      <WarningCircle size={18} />
                    </button>
                  )}

                  {/* Add to thread (first post only, not a reply) */}
                  {idx === posts.length - 1 && !replyTo && (
                    <button
                      data-testid="add-thread-btn"
                      onClick={addToThread}
                      className="p-2 rounded-lg text-[#555555] dark:text-[#A0A0A0] hover:text-[#E1D4F9] dark:hover:text-[#B8A3E6] hover:bg-[#E1D4F9]/10 transition-all"
                      title="Add to thread"
                    >
                      <ThreadsLogo size={18} />
                    </button>
                  )}

                  {/* Remove thread post */}
                  {isThread && idx > 0 && (
                    <button onClick={() => removeThreadPost(idx)} className="p-2 rounded-lg text-[#555555] dark:text-[#A0A0A0] hover:text-red-500 transition-all">
                      <X size={16} />
                    </button>
                  )}

                  {/* Char count */}
                  <span className={`text-xs font-medium ml-1 ${remaining < 20 ? (remaining < 0 ? 'text-red-500' : 'text-[#FAD9A6]') : 'text-[#555555]/60 dark:text-[#A0A0A0]/60'}`}>
                    {remaining < 50 ? remaining : ''}
                  </span>
                </div>

                {/* Submit on last post */}
                {idx === posts.length - 1 && (
                  <button
                    data-testid="post-submit-btn"
                    onClick={handleSubmit}
                    disabled={!allValid || loading}
                    className="px-5 py-2 bg-[#A3E6D0] hover:bg-[#8DD4BE] dark:bg-[#85D4B9] dark:hover:bg-[#A3E6D0] text-[#111111] font-['Outfit',sans-serif] font-semibold text-sm rounded-xl border border-[#111111] dark:border-transparent neo-shadow-sm transition-all duration-150 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0"
                  >
                    {loading ? '...' : isThread ? 'Post Thread' : replyTo ? 'Reply' : 'Post'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
};

export default PostComposer;

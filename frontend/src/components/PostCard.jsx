import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChatTeardrop, Heart, ArrowsClockwise, BookmarkSimple, Trash,
  PencilSimple, Check, X, Quotes, Eye, Seal, Warning
} from '@phosphor-icons/react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatRelativeTime, renderContent } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const QuotedPost = ({ quoted }) => {
  const navigate = useNavigate();
  if (!quoted) return null;
  return (
    <div
      data-testid="quoted-post"
      onClick={e => { e.stopPropagation(); navigate(`/post/${quoted.id}`); }}
      className="mt-2 p-3 rounded-xl border border-[#111111]/15 dark:border-[#333333] bg-[#FCFBF4] dark:bg-[#111111] hover:border-[#A3E6D0] dark:hover:border-[#85D4B9] transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-5 h-5 rounded-lg bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 flex items-center justify-center text-[9px] font-bold overflow-hidden">
          {quoted.author?.avatar_url
            ? <img src={quoted.author.avatar_url} alt="" className="w-full h-full object-cover" />
            : quoted.author?.display_name?.slice(0, 2).toUpperCase()
          }
        </div>
        <span className="text-xs font-semibold text-[#111111] dark:text-[#F5F5F5]">{quoted.author?.display_name}</span>
        <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">@{quoted.author?.username}</span>
      </div>
      <p className="text-xs text-[#111111] dark:text-[#F5F5F5] line-clamp-3 leading-relaxed">{quoted.content}</p>
      {quoted.media_urls?.[0] && (
        <img src={quoted.media_urls[0]} alt="" className="mt-1.5 w-full h-20 object-cover rounded-lg" />
      )}
    </div>
  );
};

const PostCard = ({ post: initialPost, onDelete, onQuote, showThread = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [likeAnim, setLikeAnim] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editLoading, setEditLoading] = useState(false);
  const [cwRevealed, setCwRevealed] = useState(false);

  const isOwner = user && user.id === post.author.id;

  const handleLike = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${API}/posts/${post.id}/like`);
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 250);
      setPost(prev => ({ ...prev, liked: res.data.liked, like_count: prev.like_count + (res.data.liked ? 1 : -1) }));
    } catch {}
  };

  const handleRepost = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${API}/posts/${post.id}/repost`);
      setPost(prev => ({ ...prev, reposted: res.data.reposted, repost_count: prev.repost_count + (res.data.reposted ? 1 : -1) }));
    } catch {}
  };

  const handleBookmark = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${API}/posts/${post.id}/bookmark`);
      setPost(prev => ({ ...prev, bookmarked: res.data.bookmarked, bookmark_count: prev.bookmark_count + (res.data.bookmarked ? 1 : -1) }));
    } catch {}
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/posts/${post.id}`);
      if (onDelete) onDelete(post.id);
    } catch {}
  };

  const handleSaveEdit = async (e) => {
    e.stopPropagation();
    if (!editContent.trim()) return;
    setEditLoading(true);
    try {
      const res = await axios.put(`${API}/posts/${post.id}`, { content: editContent });
      setPost(res.data);
      setEditing(false);
    } catch {}
    setEditLoading(false);
  };

  const handleQuote = (e) => {
    e.stopPropagation();
    if (onQuote) onQuote(post);
    else navigate(`/home?quote=${post.id}`);
  };

  const handlePostClick = () => {
    if (!editing) navigate(`/post/${post.id}`);
  };

  const handleAuthorClick = (e) => {
    e.stopPropagation();
    navigate(`/profile/${post.author.username}`);
  };

  return (
    <article
      data-testid={`post-card-${post.id}`}
      onClick={handlePostClick}
      className="border-b border-[#111111]/10 dark:border-[#333333] px-4 py-4 hover:bg-[#111111]/[0.02] dark:hover:bg-[#F5F5F5]/[0.02] cursor-pointer transition-colors duration-150 fade-in-up"
    >
      {/* Thread indicator */}
      {post.thread_id && post.thread_position > 0 && (
        <div className="flex items-center gap-1.5 mb-2 ml-1">
          <div className="w-6 h-0.5 bg-[#111111]/15 dark:bg-[#333333]" />
          <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">Thread</span>
        </div>
      )}

      <div className="flex gap-3">
        {/* Avatar */}
        <button
          onClick={handleAuthorClick}
          data-testid={`post-author-avatar-${post.id}`}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#E1D4F9] dark:bg-[#B8A3E6]/40 border border-[#111111]/10 dark:border-[#333333] flex items-center justify-center text-xs font-bold text-[#111111] dark:text-[#F5F5F5] overflow-hidden hover:opacity-80 transition-opacity"
        >
          {post.author.avatar_url
            ? <img src={post.author.avatar_url} alt={post.author.display_name} className="w-full h-full object-cover" />
            : post.author.display_name?.slice(0, 2).toUpperCase()
          }
        </button>

        <div className="flex-1 min-w-0">
          {/* Author info */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <button
              onClick={handleAuthorClick}
              data-testid={`post-author-name-${post.id}`}
              className="font-['Outfit',sans-serif] font-semibold text-sm text-[#111111] dark:text-[#F5F5F5] hover:underline flex items-center gap-1"
            >
              {post.author.display_name}
              {post.author.verified && (
                <Seal size={14} weight="fill" className="text-[#90C2F0]" data-testid="verified-badge" />
              )}
            </button>
            <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">@{post.author.username}</span>
            <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">·</span>
            <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">{formatRelativeTime(post.created_at)}</span>
            {post.edited && <span className="text-xs text-[#555555] dark:text-[#A0A0A0] italic">(edited)</span>}
          </div>

          {/* Reply indicator */}
          {post.is_reply && post.reply_to && (
            <p className="text-xs text-[#555555] dark:text-[#A0A0A0] mb-1">Replying to a post</p>
          )}

          {/* Content Warning overlay */}
          {post.content_warning && !cwRevealed ? (
            <div
              data-testid={`content-warning-${post.id}`}
              onClick={e => { e.stopPropagation(); setCwRevealed(true); }}
              className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#FAD9A6]/30 dark:bg-[#EBBF7E]/10 border border-[#FAD9A6] dark:border-[#EBBF7E]/30 rounded-xl cursor-pointer hover:bg-[#FAD9A6]/50 dark:hover:bg-[#EBBF7E]/20 transition-colors"
            >
              <Warning size={16} className="text-[#EBBF7E] flex-shrink-0" />
              <span className="text-xs font-medium text-[#111111] dark:text-[#F5F5F5]">
                {post.content_warning_label || 'Sensitive content'} — click to show
              </span>
            </div>
          ) : (
            <>
              {post.content_warning && cwRevealed && (
                <div className="mt-1 flex items-center gap-1.5 mb-1">
                  <Warning size={12} className="text-[#EBBF7E]" />
                  <span className="text-xs text-[#EBBF7E]">{post.content_warning_label || 'Sensitive'}</span>
                </div>
              )}

              {/* Edit mode */}
              {editing ? (
                <div className="mt-2" onClick={e => e.stopPropagation()}>
                  <textarea
                    data-testid={`edit-textarea-${post.id}`}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full bg-white dark:bg-[#1A1A1A] border border-[#A3E6D0] dark:border-[#85D4B9] rounded-xl px-3 py-2 text-sm text-[#111111] dark:text-[#F5F5F5] focus:outline-none resize-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      data-testid={`save-edit-post-${post.id}`}
                      onClick={handleSaveEdit}
                      disabled={editLoading}
                      className="flex items-center gap-1 px-3 py-1.5 bg-[#A3E6D0] dark:bg-[#85D4B9] text-[#111111] text-xs font-semibold rounded-lg border border-[#111111]/20 dark:border-transparent"
                    >
                      <Check size={12} weight="bold" />
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      data-testid={`cancel-edit-post-${post.id}`}
                      onClick={e => { e.stopPropagation(); setEditing(false); setEditContent(post.content); }}
                      className="flex items-center gap-1 px-3 py-1.5 border border-[#111111]/20 dark:border-[#333333] text-xs font-semibold text-[#555555] dark:text-[#A0A0A0] rounded-lg"
                    >
                      <X size={12} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  data-testid={`post-content-${post.id}`}
                  className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-1 leading-relaxed whitespace-pre-wrap break-words"
                >
                  {renderContent(post.content, navigate)}
                </p>
              )}

              {/* Media */}
              {post.media_urls && post.media_urls.length > 0 && (
                <div className={`mt-2 grid gap-1.5 rounded-xl overflow-hidden ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {post.media_urls.slice(0, 4).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full h-48 object-cover" onClick={e => e.stopPropagation()} />
                  ))}
                </div>
              )}

              {/* Quoted post */}
              {post.quoted_post && <QuotedPost quoted={post.quoted_post} />}
            </>
          )}

          {/* View count */}
          {post.view_count > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <Eye size={12} className="text-[#555555] dark:text-[#A0A0A0]" />
              <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">{post.view_count} {post.view_count === 1 ? 'view' : 'views'}</span>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-1 mt-3 -ml-2" onClick={e => e.stopPropagation()}>
            {/* Reply */}
            <button data-testid={`reply-btn-${post.id}`} onClick={handlePostClick} className="post-action-btn group">
              <ChatTeardrop size={17} className="group-hover:text-[#90C2F0] transition-colors" />
              {post.reply_count > 0 && <span>{post.reply_count}</span>}
            </button>

            {/* Repost dropdown (repost or quote) */}
            <button data-testid={`repost-btn-${post.id}`} onClick={handleRepost} className={`post-action-btn group ${post.reposted ? 'reposted' : ''}`}>
              <ArrowsClockwise size={17} className={post.reposted ? '' : 'group-hover:text-[#A3E6D0] transition-colors'} />
              {post.repost_count > 0 && <span>{post.repost_count}</span>}
            </button>

            {/* Quote */}
            <button data-testid={`quote-btn-${post.id}`} onClick={handleQuote} className="post-action-btn group">
              <Quotes size={17} className="group-hover:text-[#E1D4F9] transition-colors" />
            </button>

            {/* Like */}
            <button data-testid={`like-btn-${post.id}`} onClick={handleLike} className={`post-action-btn group ${post.liked ? 'liked' : ''}`}>
              <Heart
                size={17}
                weight={post.liked ? 'fill' : 'regular'}
                className={`transition-colors ${likeAnim ? 'like-pop' : ''} ${!post.liked ? 'group-hover:text-[#FF6B6B]' : ''}`}
              />
              {post.like_count > 0 && <span>{post.like_count}</span>}
            </button>

            {/* Bookmark */}
            <button data-testid={`bookmark-btn-${post.id}`} onClick={handleBookmark} className={`post-action-btn group ${post.bookmarked ? 'bookmarked' : ''}`}>
              <BookmarkSimple size={17} weight={post.bookmarked ? 'fill' : 'regular'} className={post.bookmarked ? '' : 'group-hover:text-[#FAD9A6] transition-colors'} />
              {post.bookmark_count > 0 && <span>{post.bookmark_count}</span>}
            </button>

            {/* Edit (owner only) */}
            {isOwner && !editing && (
              <button
                data-testid={`edit-btn-${post.id}`}
                onClick={e => { e.stopPropagation(); setEditing(true); }}
                className="post-action-btn group ml-auto"
              >
                <PencilSimple size={17} className="group-hover:text-[#E1D4F9] transition-colors" />
              </button>
            )}

            {/* Delete (owner only) */}
            {isOwner && (
              <button data-testid={`delete-btn-${post.id}`} onClick={handleDelete} className="post-action-btn group">
                <Trash size={17} className="group-hover:text-red-500 transition-colors" />
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};

export default PostCard;

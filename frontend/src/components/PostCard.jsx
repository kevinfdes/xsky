import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatTeardrop, Heart, ArrowsClockwise, BookmarkSimple, Trash } from '@phosphor-icons/react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { formatRelativeTime, renderContent } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PostCard = ({ post: initialPost, onDelete, showThread = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [likeAnim, setLikeAnim] = useState(false);

  const isOwner = user && user.id === post.author.id;

  const handleLike = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${API}/posts/${post.id}/like`);
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 250);
      setPost(prev => ({
        ...prev,
        liked: res.data.liked,
        like_count: prev.like_count + (res.data.liked ? 1 : -1),
      }));
    } catch {}
  };

  const handleRepost = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${API}/posts/${post.id}/repost`);
      setPost(prev => ({
        ...prev,
        reposted: res.data.reposted,
        repost_count: prev.repost_count + (res.data.reposted ? 1 : -1),
      }));
    } catch {}
  };

  const handleBookmark = async (e) => {
    e.stopPropagation();
    try {
      const res = await axios.post(`${API}/posts/${post.id}/bookmark`);
      setPost(prev => ({
        ...prev,
        bookmarked: res.data.bookmarked,
        bookmark_count: prev.bookmark_count + (res.data.bookmarked ? 1 : -1),
      }));
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

  const handlePostClick = () => {
    navigate(`/post/${post.id}`);
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
          {/* Author info + time */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <button
              onClick={handleAuthorClick}
              data-testid={`post-author-name-${post.id}`}
              className="font-['Outfit',sans-serif] font-semibold text-sm text-[#111111] dark:text-[#F5F5F5] hover:underline"
            >
              {post.author.display_name}
            </button>
            <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">@{post.author.username}</span>
            <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">·</span>
            <span className="text-xs text-[#555555] dark:text-[#A0A0A0]">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>

          {/* Reply indicator */}
          {post.is_reply && post.reply_to && (
            <p className="text-xs text-[#555555] dark:text-[#A0A0A0] mb-1">Replying to a post</p>
          )}

          {/* Content */}
          <p
            data-testid={`post-content-${post.id}`}
            className="text-sm text-[#111111] dark:text-[#F5F5F5] mt-1 leading-relaxed whitespace-pre-wrap break-words"
          >
            {renderContent(post.content, navigate)}
          </p>

          {/* Media */}
          {post.media_urls && post.media_urls.length > 0 && (
            <div className={`mt-2 grid gap-1.5 rounded-xl overflow-hidden ${post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {post.media_urls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-full h-48 object-cover"
                  onClick={e => e.stopPropagation()}
                />
              ))}
            </div>
          )}

          {/* Action bar */}
          <div
            className="flex items-center gap-1 mt-3 -ml-2"
            onClick={e => e.stopPropagation()}
          >
            {/* Reply */}
            <button
              data-testid={`reply-btn-${post.id}`}
              onClick={handlePostClick}
              className="post-action-btn group"
            >
              <ChatTeardrop size={17} className="group-hover:text-[#90C2F0] transition-colors" />
              {post.reply_count > 0 && <span>{post.reply_count}</span>}
            </button>

            {/* Repost */}
            <button
              data-testid={`repost-btn-${post.id}`}
              onClick={handleRepost}
              className={`post-action-btn group ${post.reposted ? 'reposted' : ''}`}
            >
              <ArrowsClockwise size={17} className={post.reposted ? '' : 'group-hover:text-[#A3E6D0] transition-colors'} />
              {post.repost_count > 0 && <span>{post.repost_count}</span>}
            </button>

            {/* Like */}
            <button
              data-testid={`like-btn-${post.id}`}
              onClick={handleLike}
              className={`post-action-btn group ${post.liked ? 'liked' : ''}`}
            >
              <Heart
                size={17}
                weight={post.liked ? 'fill' : 'regular'}
                className={`transition-colors ${likeAnim ? 'like-pop' : ''} ${!post.liked ? 'group-hover:text-[#FF6B6B]' : ''}`}
              />
              {post.like_count > 0 && <span>{post.like_count}</span>}
            </button>

            {/* Bookmark */}
            <button
              data-testid={`bookmark-btn-${post.id}`}
              onClick={handleBookmark}
              className={`post-action-btn group ${post.bookmarked ? 'bookmarked' : ''}`}
            >
              <BookmarkSimple
                size={17}
                weight={post.bookmarked ? 'fill' : 'regular'}
                className={post.bookmarked ? '' : 'group-hover:text-[#FAD9A6] transition-colors'}
              />
              {post.bookmark_count > 0 && <span>{post.bookmark_count}</span>}
            </button>

            {/* Delete (owner only) */}
            {isOwner && (
              <button
                data-testid={`delete-btn-${post.id}`}
                onClick={handleDelete}
                className="post-action-btn group ml-auto"
              >
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

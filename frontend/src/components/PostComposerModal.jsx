import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';
import PostComposer from './PostComposer';
import { useNavigate } from 'react-router-dom';

const PostComposerModal = ({ onClose }) => {
  const navigate = useNavigate();

  const handlePost = (newPost) => {
    onClose();
    navigate('/home');
  };

  return (
    <div
      data-testid="composer-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-[#FCFBF4] dark:bg-[#1A1A1A] border border-[#111111] dark:border-[#333333] rounded-2xl neo-shadow overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#111111]/10 dark:border-[#333333]">
          <h3 className="font-['Outfit',sans-serif] font-semibold text-[#111111] dark:text-[#F5F5F5]">
            New Post
          </h3>
          <button
            data-testid="close-composer-modal"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#111111]/10 dark:hover:bg-[#F5F5F5]/10 text-[#555555] dark:text-[#A0A0A0] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <PostComposer onPost={handlePost} />
      </div>
    </div>
  );
};

export default PostComposerModal;

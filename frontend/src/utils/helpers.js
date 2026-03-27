export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function renderContent(content, navigate) {
  if (!content) return null;
  // Split on hashtags and @mentions
  const parts = content.split(/(#\w+|@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('#')) {
      const tag = part.slice(1);
      return (
        <span
          key={i}
          className="hashtag cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/hashtag/${encodeURIComponent(tag)}`);
          }}
        >
          {part}
        </span>
      );
    }
    if (part.startsWith('@')) {
      const username = part.slice(1);
      return (
        <span
          key={i}
          className="mention cursor-pointer hover:underline font-medium text-[#90C2F0] dark:text-[#90C2F0]"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/profile/${username}`);
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function getAvatarFallback(displayName) {
  if (!displayName) return '?';
  return displayName.slice(0, 2).toUpperCase();
}

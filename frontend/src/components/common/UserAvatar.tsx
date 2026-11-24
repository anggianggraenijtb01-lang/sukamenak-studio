import React, { useState } from 'react';
import { fileUrl } from '../../api/client';

interface UserAvatarProps {
  name: string | null | undefined;
  avatarUrl: string | null | undefined;
  /** Size, shape, border and text size of the circle (the initial scales with the text size given here). */
  className: string;
  /** Alt text of the photo. Omit for a decorative avatar (e.g. next to the visible name). */
  alt?: string;
  children?: React.ReactNode;
}

export const initialOf = (name: string | null | undefined) => (name ?? '').trim().charAt(0).toUpperCase() || '?';

/**
 * Round profile picture. The initial is always rendered underneath, so it shows while the photo loads,
 * when there is no photo, and when the photo fails (the URL is signed and expires, so a stale tab can 404).
 */
export const UserAvatar: React.FC<UserAvatarProps> = ({ name, avatarUrl, className, alt, children }) => {
  const src = fileUrl(avatarUrl);
  // Load state is tracked per URL, so a new photo starts hidden again until it has loaded.
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = src !== null && failed !== src;

  return (
    <div className={`relative overflow-hidden flex items-center justify-center font-black select-none ${className}`}>
      <span aria-hidden="true">{initialOf(name)}</span>
      {showImage && (
        <img
          key={src}
          src={src}
          alt={alt ?? ''}
          aria-hidden={alt ? undefined : true}
          draggable={false}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
          data-testid="user-avatar-img"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded === src ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {children}
    </div>
  );
};

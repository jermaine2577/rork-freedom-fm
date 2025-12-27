import { useState } from 'react';
import createContextHook from '@nkzw/create-context-hook';

export const [AnnouncementsBadgeProvider, useAnnouncementsBadge] = createContextHook(() => {
  const [showBadge, setShowBadge] = useState(true);

  const clearBadge = () => {
    setShowBadge(false);
  };

  return {
    showBadge,
    clearBadge,
  };
});

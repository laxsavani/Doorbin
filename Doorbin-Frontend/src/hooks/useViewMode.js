import { useState, useEffect } from 'react';

export const useViewMode = () => {
  const [viewMode, setViewMode] = useState(() => (window.innerWidth < 768 ? 'card' : 'stripe'));
  const [userHasToggled, setUserHasToggled] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (!userHasToggled) {
        setViewMode(window.innerWidth < 768 ? 'card' : 'stripe');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userHasToggled]);

  const changeViewMode = (mode) => {
    setViewMode(mode);
    setUserHasToggled(true);
  };

  return [viewMode, changeViewMode];
};

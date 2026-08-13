import { useState, useEffect } from 'react';

export const useViewMode = (defaultMobileMode = 'card') => {
  const isMobile = () => (typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [viewMode, setViewMode] = useState(() => (isMobile() ? defaultMobileMode : 'stripe'));
  const [userHasToggled, setUserHasToggled] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (!userHasToggled) {
        setViewMode(window.innerWidth < 768 ? defaultMobileMode : 'stripe');
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [userHasToggled, defaultMobileMode]);

  const changeViewMode = (mode) => {
    setViewMode(mode);
    setUserHasToggled(true);
  };

  return [viewMode, changeViewMode];
};

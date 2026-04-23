import { useState, useEffect } from 'react';

// Default values used for SSR - must be consistent between server and client initial render
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

export default function useWindowSize() {
  // Use undefined initially to indicate "not yet measured"
  // This ensures server and client both start with the same default values
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    // Mark as mounted first
    setHasMounted(true);

    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Set initial size immediately after mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Return actual window size if mounted, otherwise return defaults
  // This ensures SSR and initial client render match
  return {
    width: hasMounted ? windowSize.width : DEFAULT_WIDTH,
    height: hasMounted ? windowSize.height : DEFAULT_HEIGHT,
    hasMounted,
  };
}

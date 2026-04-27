import anime from 'animejs';
import { useEffect, useRef } from 'react';

/**
 * Premium staggered entrance animation for editor nodes using anime.js.
 *
 * Takes a container ref and animate children (nodes) with a "physically based"
 * easing and a slight delay between each one based on their appearance order.
 */
export function useStaggerAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  nodeCount: number
) {
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only animate on first meaningful mount (when nodes are loaded)
    if (nodeCount > 0 && !hasAnimated.current && containerRef.current) {
      hasAnimated.current = true;

      // Select all node cards within the layer
      const nodeElements = containerRef.current.querySelectorAll('.wf_event');

      if (nodeElements.length === 0) {
        // Retry shortly if the DOM isn't ready yet
        const timer = setTimeout(() => {
          hasAnimated.current = false;
        }, 100);
        return () => clearTimeout(timer);
      }

      // Initial state: hidden and slightly scaled down
      anime.set(nodeElements, {
        opacity: 0,
        scale: 0.85,
        translateY: 20,
      });

      // Staggered entrance
      anime({
        targets: nodeElements,
        opacity: [0, 1],
        scale: [0.85, 1],
        translateY: [20, 0],
        delay: anime.stagger(60, { easing: 'easeOutQuad' }),
        duration: 800,
        easing: 'cubicBezier(0.22, 1, 0.36, 1)', // Expo-out for premium feel
      });
    }
  }, [nodeCount, containerRef]);
}

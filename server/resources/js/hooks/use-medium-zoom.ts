import { useEffect, useRef } from 'react';
import mediumZoom, { Zoom, ZoomOptions } from 'medium-zoom';

export function useMediumZoom(
  target: string | React.RefObject<HTMLImageElement | null> = '[data-zoomable]',
  options?: ZoomOptions
) {
  const zoomRef = useRef<Zoom | null>(null);

  useEffect(() => {
    const defaultOptions: ZoomOptions = {
      background: 'rgba(15, 23, 42, 0.94)',
      margin: 24,
      scrollOffset: 40,
      ...options,
    };

    if (typeof target === 'string') {
      zoomRef.current = mediumZoom(target, defaultOptions);
    } else if (target.current) {
      zoomRef.current = mediumZoom(target.current, defaultOptions);
    }

    return () => {
      zoomRef.current?.detach();
    };
  }, [target, options]);

  return zoomRef;
}

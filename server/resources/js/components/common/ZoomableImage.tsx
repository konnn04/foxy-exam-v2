import React, { useRef, useEffect } from 'react';
import mediumZoom, { Zoom } from 'medium-zoom';
import { ZoomIn } from 'lucide-react';

interface ZoomableImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  hintText?: string;
  containerClassName?: string;
}

export default function ZoomableImage({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  hintText,
  onError,
  ...props
}: ZoomableImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef<Zoom | null>(null);

  useEffect(() => {
    if (imgRef.current) {
      zoomRef.current = mediumZoom(imgRef.current, {
        background: 'rgba(15, 23, 42, 0.94)',
        margin: 24,
        scrollOffset: 40,
      });
    }

    return () => {
      zoomRef.current?.detach();
    };
  }, [src]);

  return (
    <div className={`relative group/zoom cursor-zoom-in overflow-hidden rounded-lg ${containerClassName}`}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={onError}
        data-zoomable
        className={`w-full h-auto block transition-transform duration-300 group-hover/zoom:scale-[1.015] ${className}`}
        {...props}
      />
      <div className="absolute bottom-3 right-3 opacity-0 group-hover/zoom:opacity-100 transition-all duration-200 bg-slate-950/85 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg pointer-events-none flex items-center gap-1.5 shadow-lg border border-slate-700/60">
        <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
        <span>{hintText || 'Phóng to'}</span>
      </div>
    </div>
  );
}

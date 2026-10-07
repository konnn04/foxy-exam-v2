import { useState, useEffect } from 'react';

/**
 * Hook làm mượt debounce cho input search và filter
 * Dễ dàng chia sẻ sang Tauri Client (FoxyClient)
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

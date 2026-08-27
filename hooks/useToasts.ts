import { useCallback, useRef, useState } from 'react';
import type { ToastMessage } from '@/components/map/Toast';

const AUTO_DISMISS_MS = 5000;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const push = useCallback((text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return { toasts, push };
}

import { useEffect, useRef, useState } from "react";

export interface PenaltyFlash {
  id: number;
  amount: number;
}

let nextId = 0;

/** Emits a short-lived flash entry every time `penaltySeconds` increases, so the UI
 * can show a "+Ns" indicator the instant a hint or wrong guess adds time. */
export function usePenaltyFlashes(penaltySeconds: number): PenaltyFlash[] {
  const [flashes, setFlashes] = useState<PenaltyFlash[]>([]);
  const previous = useRef(penaltySeconds);
  const pendingTimeouts = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const delta = penaltySeconds - previous.current;
    previous.current = penaltySeconds;
    if (delta <= 0) return;

    const id = nextId++;
    setFlashes((current) => [...current, { id, amount: delta }]);
    const timeout = setTimeout(() => {
      pendingTimeouts.current.delete(timeout);
      setFlashes((current) => current.filter((flash) => flash.id !== id));
    }, 1100);
    pendingTimeouts.current.add(timeout);
  }, [penaltySeconds]);

  // Only clears on unmount — each flash's own timeout above always runs to completion
  // otherwise, so back-to-back penalties don't cancel each other's removal.
  useEffect(() => {
    const timeouts = pendingTimeouts.current;
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return flashes;
}

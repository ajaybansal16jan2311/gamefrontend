"use client";

import { useCallback, useState } from "react";
import { addSpinLog } from "./spinDebugStore";

// NOTE:
// User ne bola hai spinner rotation ka saara code hata do.
// Is hook ko ab sirf basic logging + static rotations ke liye chhoda hai.

export function useSpinEngine(): {
  rotation1: number;
  rotation2: number;
  spinToResult: (resultNumber: string) => void;
  reset: () => void;
} {
  const [rotation1, setRotation1] = useState(0);
  const [rotation2, setRotation2] = useState(0);

  const reset = useCallback(() => {
    setRotation1(0);
    setRotation2(0);
    addSpinLog({ type: "RESET", data: { reason: "rotation disabled" } });
  }, []);

  const spinToResult = useCallback((resultNumber: string) => {
    addSpinLog({
      type: "SPIN_REQUEST",
      data: { resultNumber, note: "rotation disabled" },
    });

    // Koi animation / rotation nahi – wheels static rahenge.
    setRotation1(0);
    setRotation2(0);

    addSpinLog({
      type: "SPIN_COMPLETE",
      data: { note: "no rotation, completed instantly" },
    });
  }, []);

  return { rotation1, rotation2, spinToResult, reset };
}

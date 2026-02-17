"use client";

import { useEffect } from "react";

export default function DisableNumberWheel() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement)) return;
      if (activeElement.type !== "number") return;

      const target =
        event.target instanceof Element
          ? event.target.closest('input[type="number"]')
          : null;

      if (target === activeElement) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", onWheel, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener("wheel", onWheel, true);
    };
  }, []);

  return null;
}

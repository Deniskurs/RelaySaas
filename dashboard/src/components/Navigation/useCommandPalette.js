import { useEffect, useCallback } from "react";

export function useCommandPalette(onOpen) {
  const handleKeyDown = useCallback(
    (event) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        onOpen?.();
      }
    },
    [onOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

export default useCommandPalette;

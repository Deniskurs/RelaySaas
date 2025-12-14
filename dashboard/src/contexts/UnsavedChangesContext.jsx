import { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";

const UnsavedChangesContext = createContext({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  onSave: null,
  setOnSave: () => {},
  onDiscard: null,
  setOnDiscard: () => {},
});

export function UnsavedChangesProvider({ children }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Use refs to store callbacks so they persist across renders
  // This avoids the function wrapper instability issue
  const onSaveRef = useRef(null);
  const onDiscardRef = useRef(null);

  // Stable setter for onSave that stores in ref
  const setOnSave = useCallback((fn) => {
    onSaveRef.current = fn;
  }, []);

  // Stable setter for onDiscard that stores in ref
  const setOnDiscard = useCallback((fn) => {
    onDiscardRef.current = fn;
  }, []);

  // Stable getter for onSave
  const getOnSave = useCallback(() => onSaveRef.current, []);

  // Stable getter for onDiscard
  const getOnDiscard = useCallback(() => onDiscardRef.current, []);

  // Create stable context value
  const value = useMemo(() => ({
    hasUnsavedChanges,
    setHasUnsavedChanges,
    // Use getters so consumers always get fresh function references
    get onSave() { return onSaveRef.current; },
    get onDiscard() { return onDiscardRef.current; },
    setOnSave,
    setOnDiscard,
  }), [hasUnsavedChanges, setOnSave, setOnDiscard]);

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}

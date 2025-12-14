import { createContext, useContext, useState } from "react";

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
  const [onSave, setOnSave] = useState(null);
  const [onDiscard, setOnDiscard] = useState(null);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        onSave,
        setOnSave: (fn) => setOnSave(() => fn),
        onDiscard,
        setOnDiscard: (fn) => setOnDiscard(() => fn),
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}

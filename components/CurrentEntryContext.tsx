import React, { createContext, useContext, useState } from 'react';

// Context for sharing current entry ID
interface CurrentEntryContextType {
  currentEntryId: string | null;
  setCurrentEntryId: (id: string | null) => void;
}

const CurrentEntryContext = createContext<CurrentEntryContextType | undefined>(undefined);

export const CurrentEntryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  return (
    <CurrentEntryContext.Provider value={{ currentEntryId, setCurrentEntryId }}>
      {children}
    </CurrentEntryContext.Provider>
  );
};

export const useCurrentEntry = () => {
  const context = useContext(CurrentEntryContext);
  if (context === undefined) {
    throw new Error('useCurrentEntry must be used within a CurrentEntryProvider');
  }
  return context;
};
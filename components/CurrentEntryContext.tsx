import React, { createContext, useContext, useState } from 'react';

// Context for sharing current entry ID
interface CurrentEntryContextType {
  currentEntryId: string | null;
  setCurrentEntryId: (id: string | null) => void;
}

const CurrentEntryContext = createContext<CurrentEntryContextType | undefined>(undefined);

export const useCurrentEntry = () => {
  const context = useContext(CurrentEntryContext);
  if (!context) {
    throw new Error('useCurrentEntry must be used within a CurrentEntryProvider');
  }
  return context;
};

interface CurrentEntryProviderProps {
  children: React.ReactNode;
}

export const CurrentEntryProvider: React.FC<CurrentEntryProviderProps> = ({ children }) => {
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  return (
    <CurrentEntryContext.Provider value={{ currentEntryId, setCurrentEntryId }}>
      {children}
    </CurrentEntryContext.Provider>
  );
};

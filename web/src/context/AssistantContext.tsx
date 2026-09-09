'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type AssistantOpenMode = 'voice' | 'text' | 'image';

export interface ImageAttachment {
  file: File;
  preview: string;
}

interface AssistantContextType {
  isOpen: boolean;
  openMode: AssistantOpenMode;
  initialQuery: string;
  initialImage: ImageAttachment | null;
  openAssistant: (mode?: AssistantOpenMode, initialQuery?: string, initialImage?: ImageAttachment | null) => void;
  closeAssistant: () => void;
  setInitialQuery: (q: string) => void;
  setInitialImage: (img: ImageAttachment | null) => void;
}

const AssistantContext = createContext<AssistantContextType | undefined>(undefined);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openMode, setOpenMode] = useState<AssistantOpenMode>('text');
  const [initialQuery, setInitialQuery] = useState('');
  const [initialImage, setInitialImage] = useState<ImageAttachment | null>(null);

  const openAssistant = useCallback(
    (mode: AssistantOpenMode = 'text', query: string = '', image: ImageAttachment | null = null) => {
      setOpenMode(mode);
      if (query) setInitialQuery(query);
      if (image) setInitialImage(image);
      setIsOpen(true);
    },
    []
  );

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <AssistantContext.Provider
      value={{
        isOpen,
        openMode,
        initialQuery,
        initialImage,
        openAssistant,
        closeAssistant,
        setInitialQuery,
        setInitialImage,
      }}
    >
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}

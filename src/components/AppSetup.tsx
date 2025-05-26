
"use client";

import type { ReactNode } from 'react';
// useEffect removed as service worker registration is removed
import { Toaster } from "@/components/ui/toaster";

interface AppSetupProps {
  children: ReactNode;
}

export default function AppSetup({ children }: AppSetupProps) {
  // useEffect for service worker registration removed

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

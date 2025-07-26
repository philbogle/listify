
"use client";

import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";
import { Scan, Mic, Sparkles } from "lucide-react";

interface UserSignInPromptProps {
  currentUser: User | null;
  firebaseReady: boolean;
  isLoading: boolean;
  onSignIn: () => void;
}

const UserSignInPrompt: React.FC<UserSignInPromptProps> = ({
  currentUser,
  firebaseReady,
  isLoading,
  onSignIn,
}) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted || currentUser || !firebaseReady || isLoading) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mt-8 text-center bg-card border rounded-lg shadow-md p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-card-foreground">Welcome to Listify!</h2>
      <p className="mt-2 text-muted-foreground max-w-prose mx-auto">
        Turn photos of handwritten notes, printed text, or even physical objects into organized checklists.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Scan className="h-4 w-4 text-primary" />
          <span>Scan Lists & Objects</span>
        </div>
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          <span>Dictate or Paste Text</span>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Autogenerate Items with AI</span>
        </div>
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
          Sign in to save your lists to the cloud, sync across devices, and share with others.
      </p>
      <Button onClick={onSignIn} className="mt-6 px-8 py-3 text-base font-semibold">
        Sign in with Google
      </Button>
    </div>
  );
};

export default UserSignInPrompt;

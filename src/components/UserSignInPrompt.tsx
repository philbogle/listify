
"use client";

import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";

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
    <div className="w-full max-w-2xl mt-12 bg-card border rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center">
      <h1 className="text-xl font-semibold mb-2">Welcome to Listify!</h1>
      <p className="text-muted-foreground mb-1 text-center text-sm">
        Access shared lists anytime.
      </p>
      <p className="text-muted-foreground mb-4 text-center text-sm">
        To create and manage your own lists, scan items, or use AI autogeneration, please sign in with Google.
      </p>
      <Button onClick={onSignIn} className="px-6 py-3 text-base">
        Sign in with Google
      </Button>
    </div>
  );
};

export default UserSignInPrompt;

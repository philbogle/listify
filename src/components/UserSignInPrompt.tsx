
"use client";

import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import React from "react";

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
  if (currentUser || !firebaseReady || isLoading) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mt-12 bg-card border rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center">
      <h1 className="text-xl font-semibold mb-2">Welcome to Listify!</h1>
      <p className="text-muted-foreground mb-1 text-center text-sm">
        You&apos;re currently using Listify locally.
      </p>
      <p className="text-muted-foreground mb-4 text-center text-sm">
        Sign in with Google to sync your lists and enable cloud features like sharing. AI features like scanning and item generation are available without sign-in.
      </p>
      <Button onClick={onSignIn} className="px-6 py-3 text-base">
        Sign in with Google
      </Button>
    </div>
  );
};

export default UserSignInPrompt;

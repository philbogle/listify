
"use client";

import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Plus, Camera, Mic, Menu as MenuIcon, HelpCircle, LogOut, LogIn } from "lucide-react";
import React from "react";

interface AppHeaderProps {
  currentUser: User | null;
  firebaseReady: boolean;
  onAddNewList: () => void;
  onOpenScanDialogForNewList: () => void;
  onOpenImportListDialog: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenHelpDialog: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  firebaseReady,
  onAddNewList,
  onOpenScanDialogForNewList,
  onOpenImportListDialog,
  onSignIn,
  onSignOut,
  onOpenHelpDialog,
}) => {
  return (
    <div className="sticky top-0 z-10 bg-background py-4 flex justify-between items-center border-b">
      <h2 id="list-heading" className="text-2xl font-semibold text-center sm:text-left">Lists</h2>
      <TooltipProvider delayDuration={100}>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAddNewList} className="py-3">
                <Plus className="mr-2 h-4 w-4" /> Enter manually
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenScanDialogForNewList} className="py-3">
                <Camera className="mr-2 h-4 w-4" /> Scan
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenImportListDialog} className="py-3">
                <Mic className="mr-2 h-4 w-4" /> Dictate or Paste
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {firebaseReady && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MenuIcon className="h-5 w-5" />
                  <span className="sr-only">Open user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {currentUser ? (
                  <>
                    <DropdownMenuLabel>{currentUser.displayName || currentUser.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenHelpDialog}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Help</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={onSignIn}>
                      <LogIn className="mr-2 h-4 w-4" />
                      <span>Sign in with Google</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onOpenHelpDialog}>
                      <HelpCircle className="mr-2 h-4 w-4" />
                      <span>Help</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
};

export default AppHeader;

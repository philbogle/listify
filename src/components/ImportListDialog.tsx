
"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Send, AlertTriangle } from "lucide-react";
import type { List, Subitem } from "@/types/list";
import { extractListFromText, type ExtractListFromTextInput } from "@/ai/flows/extractListFromTextFlow";

interface ImportListDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUser: User | null;
  addList: (listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">) => Promise<List | undefined>;
  manageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
  setListToFocusId: (id: string | null) => void;
}

export default function ImportListDialog({
  isOpen,
  onOpenChange,
  currentUser,
  addList,
  manageSubitems,
  toast,
  setListToFocusId,
}: ImportListDialogProps) {
  const [inputText, setInputText] = useState("");
  const [isProcessingList, setIsProcessingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInputText("");
      setIsProcessingList(false);
      setError(null);
    }
  }, [isOpen]);

  const handleCreateListFromText = async () => {
    const textToProcess = inputText.trim();
    if (!textToProcess) {
      setError("Please enter some text to import.");
      return;
    }
    if (!currentUser) {
      toast({ title: "Sign In Required", description: "Please sign in to import/dictate lists.", variant: "destructive" });
      onOpenChange(false);
      return;
    }
    setError(null);
    setIsProcessingList(true);

    try {
      const input: ExtractListFromTextInput = { dictatedText: textToProcess };
      const result = await extractListFromText(input);

      if (result && result.parentListTitle) {
        const newParentList = await addList({ title: result.parentListTitle.trim() });
        if (newParentList && newParentList.id) {
          setListToFocusId(newParentList.id);
          if (result.extractedSubitems && result.extractedSubitems.length > 0) {
            const subitemsToAdd: Subitem[] = result.extractedSubitems
              .filter(si => si.title && si.title.trim() !== "")
              .map(si => ({
                id: crypto.randomUUID(),
                title: si.title.trim(),
                completed: false,
              }));
            if (subitemsToAdd.length > 0) {
              await manageSubitems(newParentList.id, subitemsToAdd);
            }
          }
          toast({ title: "List Imported/Dictated!", description: `"${newParentList.title}" created from your text.` });
          onOpenChange(false); 
        } else {
          toast({ title: "Import Failed", description: "Could not save the new list.", variant: "destructive" });
        }
      } else {
        toast({ title: "AI Processing Failed", description: "Could not understand the text to create a list.", variant: "destructive" });
      }
    } catch (aiError: any) {
      console.error("Error creating list from imported/dictated text:", aiError);
      let errorMsg = "An error occurred while processing the text.";
      if (aiError.message && aiError.message.includes("GEMINI_API_KEY")) {
        errorMsg = "AI processing failed. Check API key configuration.";
      } else if (aiError.message) {
        errorMsg = `AI processing error: ${aiError.message.substring(0,100)}${aiError.message.length > 100 ? '...' : ''}`;
      }
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsProcessingList(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import/Dictate List</DialogTitle>
          <DialogDescription>
            Paste your list text below or use your mobile keyboard's microphone to dictate. The AI will try to structure it.
            {!currentUser && " Sign in to enable list creation."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="my-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Input Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="e.g., Groceries for next week: milk, eggs, bread. Or just paste a list of items."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={8}
            className="resize-none"
            disabled={isProcessingList}
          />
        </div>
       
        <DialogFooter>
           <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isProcessingList}>
                Cancel
              </Button>
            </DialogClose>
            <Button
                onClick={handleCreateListFromText}
                disabled={!inputText.trim() || isProcessingList || !currentUser}
            >
                {isProcessingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Create List from Text
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

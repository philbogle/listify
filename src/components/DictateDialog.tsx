
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Loader2, MicOff, AlertTriangle, Send } from "lucide-react"; // Removed Mic
import type { List, Subitem } from "@/types/list";
import { extractListFromText, type ExtractListFromTextInput } from "@/ai/flows/extractListFromTextFlow";

interface DictateDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUser: User | null;
  addList: (listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">) => Promise<List | undefined>;
  manageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
  setListToFocusId: (id: string | null) => void;
}

export default function DictateDialog({
  isOpen,
  onOpenChange,
  currentUser,
  addList,
  manageSubitems,
  toast,
  setListToFocusId,
}: DictateDialogProps) {
  const [isListening, setIsListening] = useState(false);
  const [latestFinalTranscript, setLatestFinalTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isProcessingList, setIsProcessingList] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  // Using useRef for interimTranscript to avoid re-triggering useEffects that don't need it
  const interimTranscriptRef = useRef<string>(""); 
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const latestFinalTranscriptRef = useRef(latestFinalTranscript);

   useEffect(() => {
    latestFinalTranscriptRef.current = latestFinalTranscript;
  }, [latestFinalTranscript]);

  const resetDialogState = useCallback(() => {
    setIsListening(false);
    setLatestFinalTranscript("");
    interimTranscriptRef.current = "";
    setSpeechError(null);
    setIsProcessingList(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      resetDialogState();
      return;
    }

    let currentRecognition: SpeechRecognition | null = null;

    const initializeRecognition = async () => {
      if (typeof window === 'undefined' || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        setSpeechError("Speech recognition not supported in this browser. Try Chrome.");
        setHasMicPermission(false);
        return;
      }

      if (hasMicPermission === null) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          setHasMicPermission(true);
        } catch (err) {
          console.error("Error getting microphone permission:", err);
          setHasMicPermission(false);
          setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
          return;
        }
      }

      if (hasMicPermission === false) return; // Don't proceed if permission is explicitly denied

      try {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        currentRecognition = new SpeechRecognitionAPI();
        recognitionRef.current = currentRecognition;

        currentRecognition.continuous = true;
        currentRecognition.interimResults = true;
        currentRecognition.lang = 'en-US';

        currentRecognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
          setLatestFinalTranscript("");
          interimTranscriptRef.current = "";
          console.log('Speech recognition started.');
        };

        currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
          let final_transcript_for_this_event = latestFinalTranscriptRef.current;
          let interim_transcript_for_display = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const segmentTranscript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final_transcript_for_this_event += segmentTranscript.trim() + " ";
            } else {
              interim_transcript_for_display += segmentTranscript;
            }
          }
          
          setLatestFinalTranscript(final_transcript_for_this_event.trim());
          interimTranscriptRef.current = interim_transcript_for_display.trim(); // Use ref for internal logic
        };
        
        currentRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error, event.message);
           if (event.error === "aborted") {
            console.log("Speech recognition aborted (likely intentional).");
            if(isListening) setIsListening(false); // Ensure state consistency
            return; 
          }
          let errorMsg = `Error: ${event.error}. ${event.message || ''}`;
          if (event.error === 'no-speech') {
            errorMsg = 'No speech detected. Please try speaking clearly.';
          } else if (event.error === 'audio-capture') {
            errorMsg = 'Audio capture error. Check your microphone connection.';
          } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            errorMsg = 'Microphone access was denied. Please enable it in your browser settings and try again.';
            setHasMicPermission(false);
          } else if (event.error === 'network') {
            errorMsg = 'Network error during speech recognition. Please check your connection.';
          }
          setSpeechError(errorMsg);
          setIsListening(false);
        };

        currentRecognition.onend = () => {
          setIsListening(false);
          // Append any final interim results if recognition ends unexpectedly
          if (interimTranscriptRef.current.trim()) {
            setLatestFinalTranscript(prevFinal => (prevFinal.trim() + " " + interimTranscriptRef.current.trim()).trim());
          }
          interimTranscriptRef.current = "";
          console.log("Speech recognition ended.");
        };

        // Auto-start listening if dialog is open, permission granted, and not already listening/processing
        if (isOpen && hasMicPermission && !isListening && !isProcessingList && recognitionRef.current) {
            try {
                setLatestFinalTranscript(""); 
                interimTranscriptRef.current = "";
                recognitionRef.current.start();
            } catch (e: any) {
                console.error("Error trying to auto-start recognition:", e.message);
                setSpeechError(`Could not start listening automatically: ${e.message}`);
                setIsListening(false);
            }
        }

      } catch (e: any) {
        console.error("Error initializing SpeechRecognition:", e);
        setSpeechError(`Speech recognition init failed: ${e.message}. Try refreshing.`);
        setHasMicPermission(false);
        recognitionRef.current = null;
      }
    };

    initializeRecognition();
    
    return () => {
      if (currentRecognition) {
        currentRecognition.onstart = null;
        currentRecognition.onresult = null;
        currentRecognition.onerror = null;
        currentRecognition.onend = null;
        if (isListening) {
          currentRecognition.stop();
        }
        recognitionRef.current = null; // Clean up ref
      }
    };
  }, [ isOpen, hasMicPermission, resetDialogState, isListening, isProcessingList ]); // Added isListening, isProcessingList


  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
    }
  };

  const handleCreateListFromText = async () => {
    const textToProcess = latestFinalTranscriptRef.current.trim();
    if (!textToProcess) {
      toast({ title: "Nothing to Add", description: "Please dictate some text first.", variant: "destructive" });
      return;
    }
    if (!currentUser) {
      toast({ title: "Sign In Required", description: "Please sign in to use AI features to create lists from text.", variant: "destructive" });
      return;
    }

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
          toast({ title: "List Created!", description: `"${newParentList.title}" created from dictated text.` });
          onOpenChange(false); 
        } else {
            toast({ title: "List Creation Failed", description: "Could not save the new list.", variant: "destructive" });
        }
      } else {
        toast({ title: "AI Processing Failed", description: "Could not understand the dictated text to create a list.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error creating list from text:", error);
      let errorMsg = "An error occurred while processing the text.";
      if (error.message && error.message.includes("GEMINI_API_KEY")) {
        errorMsg = "AI processing failed. Check API key configuration.";
      } else if (error.message) {
        errorMsg = `AI processing error: ${error.message.substring(0,100)}${error.message.length > 100 ? '...' : ''}`;
      }
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsProcessingList(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open && recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
        onOpenChange(open);
        if (!open) resetDialogState();
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dictate New List</DialogTitle>
          <DialogDescription>
            {isListening ? "Listening... Speak your list items. " : "Dictation paused. "}
            Only final text will be shown.
            {!currentUser && " Sign in to use the AI feature to create lists from text."}
          </DialogDescription>
        </DialogHeader>

        {hasMicPermission === false && speechError?.includes("denied") && (
             <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Microphone Access Denied</AlertTitle>
                <AlertDescription>
                Microphone permission was denied. Please enable it in your browser settings and try again. You might need to refresh the page.
                </AlertDescription>
            </Alert>
        )}
         {hasMicPermission === false && !speechError?.includes("denied") && (
             <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Microphone Issue</AlertTitle>
                <AlertDescription>
                {speechError || "Could not access the microphone. It might be disconnected or speech recognition is not supported."}
                </AlertDescription>
            </Alert>
        )}


        {speechError && !speechError.includes("denied") && (
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Speech Recognition Error</AlertTitle>
            <AlertDescription>{speechError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 py-4">
          <Textarea
            placeholder={
              !recognitionRef.current && hasMicPermission === null ? "Initializing microphone..." :
              hasMicPermission === false ? "Microphone access denied or unavailable." :
              isListening ? "Listening... Final text will appear here." :
              speechError ? "An error occurred. Try reopening the dialog." :
              "Dictated text will appear here..."
            }
            value={latestFinalTranscript}
            readOnly={isListening} 
            onChange={(e) => {
                if (!isListening) { 
                    setLatestFinalTranscript(e.target.value);
                }
            }}
            rows={6}
            className="resize-none"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
                onClick={handleStopListening}
                variant="destructive"
                disabled={!isListening || !recognitionRef.current || isProcessingList}
                className="w-full sm:w-auto"
            >
                <MicOff className="mr-2 h-4 w-4" />
                Stop Listening
            </Button>
           <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>
            <Button
                onClick={handleCreateListFromText}
                disabled={!latestFinalTranscriptRef.current.trim() || isProcessingList || isListening || !currentUser}
                className="w-full sm:w-auto"
            >
                {isProcessingList ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Create List from Text
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


    
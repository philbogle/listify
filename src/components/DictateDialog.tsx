
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
import { Loader2, Mic, MicOff, AlertTriangle, Send } from "lucide-react";
import type { List, Subitem } from "@/types/list";
import { extractListFromText, type ExtractListFromTextInput } from "@/ai/flows/extractListFromTextFlow";

interface DictateDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentUser: User | null; // Needed for AI flow potentially if it becomes user-aware
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
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isProcessingList, setIsProcessingList] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean |null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const interimTranscriptRef = useRef(interimTranscript); // Ref to hold current interimTranscript for onend

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  const resetDialogState = useCallback(() => {
    setIsListening(false);
    setLatestFinalTranscript("");
    setInterimTranscript("");
    setSpeechError(null);
    setIsProcessingList(false);
    // Do not reset hasMicPermission here, as it's usually granted once per session
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      resetDialogState();
      return;
    }

    if (hasMicPermission === null && typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          setHasMicPermission(true);
          try {
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SpeechRecognitionAPI();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';
            recognitionRef.current = rec;
          } catch (e: any) {
            console.error("Error initializing SpeechRecognition:", e);
            setSpeechError(`Speech recognition init failed: ${e.message}. Try refreshing.`);
            setHasMicPermission(false); // Could be a setup error rather than permission
          }
        })
        .catch((err) => {
          console.error("Error getting microphone permission:", err);
          setHasMicPermission(false);
          setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
        });
    } else if (recognitionRef.current && isOpen && hasMicPermission) {
       // Re-attach listeners if dialog re-opens and recognition object exists
      const currentRecognition = recognitionRef.current;

      currentRecognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setLatestFinalTranscript(""); // Clear previous final transcript
        setInterimTranscript("");   // Clear previous interim transcript
        console.log("Speech recognition started.");
      };

      currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let newFinalTextInThisEvent = '';
        let latestInterimTextInThisEvent = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const segment = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            newFinalTextInThisEvent += segment.trim() + ' ';
          } else {
            latestInterimTextInThisEvent = segment; 
          }
        }
        
        if (newFinalTextInThisEvent.trim()) {
          setLatestFinalTranscript(prev => (prev + ' ' + newFinalTextInThisEvent).trim());
        }
        setInterimTranscript(latestInterimTextInThisEvent.trim());
      };

      currentRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error, event.message);
        if (event.error === "aborted") {
          // Often happens when dialog is closed while listening, or .stop() is called.
          // Potentially also if mic is disconnected.
          console.log("Speech recognition aborted. Likely intentional or mic issue.");
          // Don't set a user-facing error for simple aborts if it's due to stopping.
          // If it's not due to manual stop, onend might clarify.
          return; 
        }

        let errorMsg = `Error: ${event.error}. ${event.message || ''}`;
        if (event.error === 'no-speech') {
          errorMsg = 'No speech detected. Please try speaking clearly.';
        } else if (event.error === 'audio-capture') {
          errorMsg = 'Audio capture error. Check your microphone connection.';
        } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          errorMsg = 'Microphone access was denied. Please enable it in your browser settings and try again.';
          setHasMicPermission(false); // Update permission state
        } else if (event.error === 'network') {
          errorMsg = 'Network error during speech recognition. Please check your connection.';
        }
        setSpeechError(errorMsg);
        setIsListening(false);
      };

      currentRecognition.onend = () => {
        setIsListening(false);
        console.log("Speech recognition ended.");
        // If there's any remaining interim text when recognition stops, append it.
        setLatestFinalTranscript(prevFinal => {
            let updatedFinal = prevFinal;
            if (interimTranscriptRef.current.trim()) {
                updatedFinal = (prevFinal + ' ' + interimTranscriptRef.current).trim();
            }
            setInterimTranscript(''); // Clear interim after appending
            return updatedFinal;
        });
      };
    }
    
    // Cleanup
    return () => {
      if (recognitionRef.current) {
        const rec = recognitionRef.current;
        rec.onstart = null;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        if (isListening) { // Only stop if it was actively listening
          rec.stop();
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasMicPermission, resetDialogState]); // isListening was removed as it caused re-runs that stopped recognition


  const handleToggleListening = () => {
    if (!hasMicPermission || !recognitionRef.current) {
      setSpeechError("Microphone not available or permission denied. Please check browser settings.");
      if(hasMicPermission === null) { // Prompt for permission if not yet determined
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => setHasMicPermission(true))
            .catch(() => {
                setHasMicPermission(false);
                setSpeechError("Microphone permission denied.");
            });
      }
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setLatestFinalTranscript(""); 
        setInterimTranscript(""); 
        recognitionRef.current.start();
      } catch (e: any) {
        // This can happen if .start() is called too soon after .stop() or on an ended session
        console.error("Error trying to start recognition:", e.message);
        if (e.name === 'InvalidStateError') {
          setSpeechError("Recognition busy. Please wait a moment and try again.");
          // Attempt to reset and re-initialize if in a bad state
           try {
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognitionAPI();
            if (recognitionRef.current) {
                recognitionRef.current.continuous = true;
                recognitionRef.current.interimResults = true;
                recognitionRef.current.lang = 'en-US';
                 setSpeechError("Recognition re-initialized. Please try again.");
            }
           } catch (initError) {
             setSpeechError("Failed to re-initialize recognition. Try refreshing the page.");
           }

        } else {
          setSpeechError(`Could not start listening: ${e.message}`);
        }
        setIsListening(false); // Ensure listening state is false
      }
    }
  };

  const handleCreateListFromText = async () => {
    if (!latestFinalTranscript.trim()) {
      toast({ title: "Nothing to Add", description: "Please dictate some text first.", variant: "destructive" });
      return;
    }
    if (!currentUser) {
      toast({ title: "Sign In Required", description: "Please sign in to use AI features to create lists from text.", variant: "destructive" });
      return;
    }

    setIsProcessingList(true);
    try {
      const input: ExtractListFromTextInput = { dictatedText: latestFinalTranscript.trim() };
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
          onOpenChange(false); // Close dialog on success
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

  const displayedText = (latestFinalTranscript + " " + interimTranscript).trim();

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
            Speak your list items. The AI will attempt to structure them into a new list.
            {!currentUser && " Sign in to use the AI feature to create lists from text."}
          </DialogDescription>
        </DialogHeader>

        {hasMicPermission === false && !speechError?.includes("denied") && (
             <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Microphone Issue</AlertTitle>
                <AlertDescription>
                Could not access the microphone. It might be disconnected or in use by another application. Please check and try again.
                </AlertDescription>
            </Alert>
        )}

        {speechError && (
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
              isListening ? "Listening..." :
              speechError ? "An error occurred. Try again." :
              "Dictated text will appear here..."
            }
            value={displayedText}
            readOnly={isListening}
            onChange={(e) => {
                if (!isListening) { // Allow editing if not listening
                    setLatestFinalTranscript(e.target.value);
                    if(interimTranscript) setInterimTranscript(""); // Clear any stale interim if user edits
                }
            }}
            rows={6}
            className="resize-none"
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
                onClick={handleToggleListening}
                variant={isListening ? "destructive" : "default"}
                disabled={!hasMicPermission || !recognitionRef.current || isProcessingList}
                className="w-full sm:w-auto"
            >
                {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                {isListening ? "Stop Listening" : "Start Listening"}
            </Button>
           <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>
            <Button
                onClick={handleCreateListFromText}
                disabled={!latestFinalTranscript.trim() || isProcessingList || isListening || !currentUser}
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

    
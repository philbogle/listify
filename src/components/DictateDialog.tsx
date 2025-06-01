
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
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isProcessingList, setIsProcessingList] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const interimTranscriptRef = useRef(interimTranscript);
  const latestFinalTranscriptRef = useRef(latestFinalTranscript);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    latestFinalTranscriptRef.current = latestFinalTranscript;
  }, [latestFinalTranscript]);

  const resetDialogState = useCallback(() => {
    setIsListening(false);
    setLatestFinalTranscript("");
    setInterimTranscript("");
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

    if (hasMicPermission === null && typeof window !== 'undefined') {
      if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            setHasMicPermission(true);
            try {
              const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
              const rec = new SpeechRecognitionAPI();
              rec.continuous = true; // Keep listening even after a pause
              rec.interimResults = true;
              rec.lang = 'en-US';
              recognitionRef.current = rec;
            } catch (e: any) {
              console.error("Error initializing SpeechRecognition:", e);
              setSpeechError(`Speech recognition init failed: ${e.message}. Try refreshing.`);
              setHasMicPermission(false);
              recognitionRef.current = null; 
            }
          })
          .catch((err) => {
            console.error("Error getting microphone permission:", err);
            setHasMicPermission(false);
            setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
          });
      } else {
        setSpeechError("Speech recognition not supported in this browser. Try Chrome.");
        setHasMicPermission(false);
      }
    }

    const currentRecognition = recognitionRef.current;
    if (currentRecognition && isOpen && hasMicPermission) {
      currentRecognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setLatestFinalTranscript(""); 
        setInterimTranscript("");   
        console.log("Speech recognition started.");
      };

      currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let currentInterimForThisEvent = "";
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const segmentTranscript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setLatestFinalTranscript(prevFinal => {
              const trimmedPrev = prevFinal.trim();
              const trimmedSegment = segmentTranscript.trim();
              return trimmedPrev ? `${trimmedPrev} ${trimmedSegment}` : trimmedSegment;
            });
            // If a part becomes final, clear the current interim display for this event,
            // as the next non-final result will be the new interim.
            currentInterimForThisEvent = ""; 
          } else {
            // Always overwrite with the latest non-final segment from this event.
            // This ensures only the most current interim phrase is captured.
            currentInterimForThisEvent = segmentTranscript;
          }
        }
        setInterimTranscript(currentInterimForThisEvent.trim());
      };

      currentRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error, event.message);
        if (event.error === "aborted") {
            // Typically, this happens if .stop() is called or the dialog is closed.
            // We don't want to show a user-facing error for this.
            console.log("Speech recognition aborted (likely intentional).");
            // Ensure listening state is correctly updated if not already done by onend.
            if(isListening) setIsListening(false);
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
        // Use the ref here to get the latest interim transcript, as state might be stale in this closure
        if (interimTranscriptRef.current.trim()) {
          setLatestFinalTranscript(prevFinal => {
            const trimmedPrev = prevFinal.trim();
            const trimmedInterim = interimTranscriptRef.current.trim();
            return trimmedPrev ? `${trimmedPrev} ${trimmedInterim}` : trimmedInterim;
          });
        }
        setInterimTranscript(""); 
        console.log("Speech recognition ended.");
      };
    }
    
    return () => {
      if (currentRecognition) {
        currentRecognition.onstart = null;
        currentRecognition.onresult = null;
        currentRecognition.onerror = null;
        currentRecognition.onend = null;
        if (isListening) { 
          currentRecognition.stop();
        }
      }
    };
  }, [ isOpen, hasMicPermission, resetDialogState, toast, currentUser, addList, manageSubitems, setListToFocusId, onOpenChange, isListening ]);


  const handleToggleListening = () => {
    if (!hasMicPermission || !recognitionRef.current) {
      setSpeechError("Microphone not available or permission denied. Please check browser settings.");
      if(hasMicPermission === null) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(() => setHasMicPermission(true)) // Will trigger useEffect to init
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
        // Clear previous transcripts explicitly before starting
        setLatestFinalTranscript(""); 
        setInterimTranscript(""); 
        recognitionRef.current.start();
      } catch (e: any) {
        console.error("Error trying to start recognition:", e.message);
        if (e.name === 'InvalidStateError' && !isListening) {
           // Attempt to re-init if in a bad state and not already trying to listen
           try {
            const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SpeechRecognitionAPI();
            rec.continuous = true;
            rec.interimResults = true;
            rec.lang = 'en-US';
            recognitionRef.current = rec; // Re-assign
            setSpeechError("Recognition re-initialized. Please try starting again.");
            // Trigger useEffect re-run to attach listeners
            setHasMicPermission(null); // Temporarily set to null to re-trigger permission check and setup in useEffect
            setTimeout(() => setHasMicPermission(true), 0); // Then quickly set back to true

           } catch (initError: any) {
             setSpeechError(`Failed to re-initialize recognition: ${initError.message}. Try refreshing the page.`);
             recognitionRef.current = null; // Ensure it's null if re-init fails
           }
        } else {
          setSpeechError(`Could not start listening: ${e.message}`);
        }
        setIsListening(false);
      }
    }
  };

  const handleCreateListFromText = async () => {
    // Use latestFinalTranscriptRef.current as state might not be updated yet from onend
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
  
  const displayedText = (latestFinalTranscriptRef.current.trim() + " " + interimTranscriptRef.current.trim()).trim();

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
              isListening ? "Listening..." :
              speechError ? "An error occurred. Try starting again." :
              "Dictated text will appear here..."
            }
            value={displayedText}
            readOnly={isListening} // Make it editable when not listening
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


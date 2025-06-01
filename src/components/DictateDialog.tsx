
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
  const [latestFinalTranscript, setLatestFinalTranscript] = useState(""); // Accumulates final results
  const [interimTranscript, setInterimTranscript] = useState(""); // Only the current interim phrase for display
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isProcessingList, setIsProcessingList] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const resetDialogState = useCallback(() => {
    setIsListening(false);
    setLatestFinalTranscript("");
    setInterimTranscript("");
    setSpeechError(null);
    setIsProcessingList(false);
    // hasMicPermission is reset by the main useEffect when dialog reopens
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      resetDialogState();
      return;
    }

    // Reset on dialog open to ensure fresh state
    resetDialogState();
    setHasMicPermission(null); // Trigger permission check / re-initialization

    let currentRecognition: SpeechRecognition | null = null;

    const initializeRecognition = async () => {
      if (typeof window === 'undefined' || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        setSpeechError("Speech recognition not supported in this browser. Try Chrome.");
        setHasMicPermission(false);
        return;
      }

       // Check permission explicitly before initializing
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          setHasMicPermission(false);
          setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
          return;
        }
        // If granted or prompt, we'll try to get user media later if needed or rely on API to prompt.
        // For now, assume we can proceed if not denied.
        setHasMicPermission(true); // Optimistic, or will be confirmed by getUserMedia if browser requires it first.
      } catch (e) {
        console.warn("Permission API for microphone not supported or errored, will proceed and let getUserMedia handle it if necessary.", e);
        // Fallback: don't set hasMicPermission to false here, let the getUserMedia prompt if needed.
        setHasMicPermission(null); // Let it be re-evaluated or handled by start.
      }


      try {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        currentRecognition = new SpeechRecognitionAPI();
        recognitionRef.current = currentRecognition;

        currentRecognition.continuous = true; // Keep listening even after pauses
        currentRecognition.interimResults = true;
        currentRecognition.lang = 'en-US';

        currentRecognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
          setInterimTranscript(""); // Clear interim display when starting
          // latestFinalTranscript is cleared by handleStartListening
          console.log('Speech recognition started.');
        };

        currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
          let current_interim_for_display = "";
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const segment = event.results[i];
            const transcript_segment_text = segment[0].transcript;

            if (segment.isFinal) {
              setLatestFinalTranscript(prevFinal => (prevFinal.trim() + " " + transcript_segment_text.trim()).trim() + " ");
              // When a segment becomes final, the interim display for that specific utterance should be cleared.
              // The next non-final segment (if any from this event, or next event) will populate it.
              current_interim_for_display = ""; 
            } else {
              current_interim_for_display = transcript_segment_text; // Always take the latest non-final
            }
          }
          setInterimTranscript(current_interim_for_display.trim());
        };
        
        currentRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error, event.message);
          if (event.error === "aborted" && !isProcessingList) { // Ignore abort if processing list, or if user clicked stop
             console.log("Speech recognition aborted (likely intentional stop or dialog close).");
             setIsListening(false); // Ensure UI reflects stopped state
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
          // If there was any last interim phrase when recognition stopped,
          // consider it final for the purpose of the accumulated text.
          if (interimTranscript.trim()) {
             setLatestFinalTranscript(prevFinal => (prevFinal.trim() + " " + interimTranscript.trim()).trim() + " ");
          }
          setInterimTranscript(""); // Clear display as listening has stopped
          console.log("Speech recognition ended.");
        };

      } catch (e: any) {
        console.error("Error initializing SpeechRecognition:", e);
        setSpeechError(`Speech recognition init failed: ${e.message}. Try refreshing.`);
        setHasMicPermission(false); // Explicitly set if init fails
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
        if (isListening) { // Use component state 'isListening'
          currentRecognition.stop();
        }
        recognitionRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ isOpen, resetDialogState, toast ]); // Removed interimTranscript from deps to avoid re-triggering on its own changes


  const handleStartListening = async () => {
    if (!recognitionRef.current || isListening || !hasMicPermission) {
        if (hasMicPermission === false) {
             setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
        } else if (!recognitionRef.current) {
             setSpeechError("Speech recognition not initialized. Try reopening the dialog.");
        }
      return;
    }
    // Check for microphone permission again before starting, some browsers might need this.
    try {
        // Try to get user media to ensure permissions are active and prompt if necessary
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the track immediately, we only needed to check/prompt for permission
        setHasMicPermission(true);
        setSpeechError(null); // Clear previous errors
    } catch (err) {
        console.error("Error getting microphone permission on start:", err);
        setHasMicPermission(false);
        setSpeechError("Microphone permission denied or microphone not available. Please enable it in your browser settings.");
        return;
    }


    setLatestFinalTranscript(""); // Clear previous final transcript for a new session
    setInterimTranscript("");   // Clear previous interim transcript
    try {
      recognitionRef.current.start();
    } catch (e: any) {
        if (e.name === 'InvalidStateError') {
            console.warn("SpeechRecognition was already started or in an invalid state. Attempting to stop and restart.");
            try {
                recognitionRef.current.stop(); // Try to stop it first
                // Give it a moment then try to start again
                setTimeout(() => {
                    if (recognitionRef.current) { // Check if still exists (dialog might have closed)
                        setLatestFinalTranscript(""); 
                        setInterimTranscript("");
                        recognitionRef.current.start();
                    }
                }, 100);
            } catch (stopError) {
                 console.error("Error trying to stop/restart recognition:", stopError);
                 setSpeechError(`Could not start listening: ${e.message}. Try again.`);
            }
        } else {
            console.error("Error starting recognition:", e);
            setSpeechError(`Could not start listening: ${e.message}`);
            setIsListening(false);
        }
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
    }
    // onend handler will set isListening to false and finalize transcripts
  };

  const handleCreateListFromText = async () => {
    const textToProcess = latestFinalTranscript.trim();
    if (!textToProcess) {
      toast({ title: "Nothing to Add", description: "Please dictate some text first by starting and stopping listening.", variant: "destructive" });
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
        // resetDialogState is called by useEffect when isOpen changes to false
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dictate New List</DialogTitle>
          <DialogDescription>
            Click "Start Listening". Only the current phrase is shown while speaking.
            Finalized text appears after stopping.
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
         {hasMicPermission === false && !speechError?.includes("denied") && recognitionRef.current === null && (
             <Alert variant="destructive" className="my-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Microphone Issue</AlertTitle>
                <AlertDescription>
                {speechError || "Could not access the microphone or speech recognition failed to initialize. Check browser compatibility (Chrome recommended)."}
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
              isListening ? "Speak now... current phrase shown." :
              speechError ? "An error occurred. Try again." :
              "Click 'Start Listening'. Final text will appear here after you stop."
            }
            value={isListening ? interimTranscript : latestFinalTranscript}
            readOnly // Textarea is only for display, not direct input
            rows={6}
            className="resize-none"
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <Button
                onClick={handleStartListening}
                variant="outline"
                disabled={isListening || !recognitionRef.current || isProcessingList || hasMicPermission === false}
                className="w-full"
            >
                <Mic className="mr-2 h-4 w-4" />
                Start Listening
            </Button>
            <Button
                onClick={handleStopListening}
                variant="destructive"
                disabled={!isListening || !recognitionRef.current || isProcessingList}
                className="w-full"
            >
                <MicOff className="mr-2 h-4 w-4" />
                Stop Listening
            </Button>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
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

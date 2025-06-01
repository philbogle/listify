
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
      resetDialogState(); // Reset full state when dialog closes
      return;
    }
    
    // Initialize/Reset relevant state when dialog opens
    setHasMicPermission(null); // Re-check permission or re-init recognition
    setLatestFinalTranscript(""); // Clear previous session text
    setInterimTranscript("");   // Clear previous interim text

    let currentRecognition: SpeechRecognition | null = null;

    const initializeRecognition = async () => {
      if (typeof window === 'undefined' || !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
        setSpeechError("Speech recognition not supported in this browser. Try Chrome.");
        setHasMicPermission(false);
        return;
      }

      try {
        const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (permissionStatus.state === 'denied') {
          setHasMicPermission(false);
          setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
          return;
        }
        setHasMicPermission(true);
      } catch (e) {
        console.warn("Microphone permission query API not supported or errored. Proceeding, speech API will prompt if needed.", e);
        setHasMicPermission(null); // Let start attempt handle it
      }

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
          // latestFinalTranscript & interimTranscript are cleared by handleStartListening
          console.log('Speech recognition started.');
        };

        currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
          let currentInterimForThisEvent = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const segment = event.results[i];
            const transcriptSegmentText = segment[0].transcript;

            if (segment.isFinal) {
              setLatestFinalTranscript(prevFinal => (prevFinal + transcriptSegmentText.trim() + " ").trimStart());
              currentInterimForThisEvent = ""; // Finalized, so clear interim for *this* specific utterance
            } else {
              currentInterimForThisEvent = transcriptSegmentText; // Keep updating with the latest non-final
            }
          }
          setInterimTranscript(currentInterimForThisEvent.trim());
        };
        
        currentRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error, event.message);
          if (event.error === "aborted") {
             setIsListening(false);
             return;
          }
          let errorMsg = `Error: ${event.error}. ${event.message || ''}`;
          if (event.error === 'no-speech') {
            errorMsg = 'No speech detected. Please try speaking clearly.';
          } else if (event.error === 'audio-capture') {
            errorMsg = 'Audio capture error. Check your microphone connection and permissions.';
             setHasMicPermission(false);
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
          setLatestFinalTranscript(prevFinal => {
            const trimmedInterim = interimTranscript.trim();
            if (trimmedInterim) {
              return (prevFinal + trimmedInterim + " ").trimStart();
            }
            return prevFinal;
          });
          setInterimTranscript("");
          console.log("Speech recognition ended.");
        };

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
        recognitionRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resetDialogState, toast, interimTranscript]);


  const handleStartListening = async () => {
    if (!recognitionRef.current || isListening) {
      if (hasMicPermission === false) {
        setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
      } else if (!recognitionRef.current) {
        setSpeechError("Speech recognition not initialized. Try reopening the dialog.");
      }
      return;
    }

    try {
      if (hasMicPermission === null || hasMicPermission === true) { // if unknown or true, try to get stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setHasMicPermission(true);
        setSpeechError(null);
      } else { // Explicitly false
         setSpeechError("Microphone permission denied. Please enable it in your browser settings.");
         return;
      }
    } catch (err) {
      console.error("Error getting microphone permission on start:", err);
      setHasMicPermission(false);
      setSpeechError("Microphone permission denied or microphone not available. Please enable it in your browser settings.");
      return;
    }

    setLatestFinalTranscript("");
    setInterimTranscript("");
    try {
      recognitionRef.current.start();
    } catch (e: any) {
      if (e.name === 'InvalidStateError' && !isListening) {
        console.warn("SpeechRecognition was in an invalid state. Attempting to stop and restart.");
        try {
          recognitionRef.current.stop(); 
          setTimeout(() => {
            if (recognitionRef.current && isOpen) {
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
  };

  const handleCreateListFromText = async () => {
    const textToProcess = latestFinalTranscript.trim();
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
  
  const displayedText = isListening ? interimTranscript : latestFinalTranscript;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open && recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
        onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dictate New List</DialogTitle>
          <DialogDescription>
            Click "Start Listening". {isListening ? "Current utterance shown." : "Final text shown."}
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
              isListening && !interimTranscript ? "Speak now..." :
              !isListening && !latestFinalTranscript ? "Click 'Start Listening'. Final text will appear here." :
              "" // Let displayedText handle it
            }
            value={displayedText}
            readOnly 
            rows={6}
            className="resize-none"
          />
           <div className="flex flex-col sm:flex-row gap-2">
            <Button
                onClick={handleStartListening}
                variant="default"
                disabled={isListening || !recognitionRef.current || isProcessingList || hasMicPermission === false}
                className="w-full sm:w-auto"
            >
                <Mic className="mr-2 h-4 w-4" />
                Start Listening
            </Button>
            <Button 
                onClick={handleStopListening}
                variant="destructive"
                disabled={!isListening || !recognitionRef.current || isProcessingList}
                className="w-full sm:w-auto"
            >
                <MicOff className="mr-2 h-4 w-4" />
                Stop Listening
            </Button>
        </div>
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


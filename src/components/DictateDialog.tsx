
"use client";

import { useState, useEffect, useRef } from "react";
import type { List, Subitem } from "@/types/list";
import { useToast } from "@/hooks/use-toast";
import { extractListFromText, type ExtractListFromTextInput } from "@/ai/flows/extractListFromTextFlow";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Mic, MicOff, AlertTriangle, Eraser } from "lucide-react";

interface DictateDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  addList: (
    listData: Omit<List, "id" | "completed" | "subitems" | "createdAt" | "userId" | "scanImageUrls" | "shareId">
  ) => Promise<List | undefined>;
  manageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  setListToFocusId: (id: string | null) => void;
}

export default function DictateDialog({
  isOpen,
  onOpenChange,
  addList,
  manageSubitems,
  setListToFocusId,
}: DictateDialogProps) {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [dictatedText, setDictatedText] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isProcessingDictation, setIsProcessingDictation] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null); // null: unknown, true: granted, false: denied

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.abort();
      }
      // Don't reset recognitionRef.current itself, it can be reused if dialog reopens.
      return;
    }

    let currentRecognition = recognitionRef.current;

    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!currentRecognition) {
        console.log("[DictateDialog] Initializing SpeechRecognitionAPI object...");
        try {
          const rec = new SpeechRecognitionAPI();
          rec.continuous = true; // Keep listening even after pauses
          rec.interimResults = true; // Get results as they come in
          rec.lang = 'en-US';
          recognitionRef.current = rec;
          currentRecognition = rec;
          console.log("[DictateDialog] SpeechRecognitionAPI object initialized:", recognitionRef.current);
        } catch (initError: any) {
          console.error("Error initializing SpeechRecognition API instance:", initError);
          setSpeechError(`Failed to init speech recognition: ${initError.message}. Try refreshing. API may be broken in this browser.`);
          // recognitionRef.current will remain null, disabling the button.
          return; // Exit effect if initialization fails
        }
      }
      
      // Ensure currentRecognition is the up-to-date ref
      currentRecognition = recognitionRef.current!;


      currentRecognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null); // Clear previous errors
        // Clear texts only on actual start, not just on effect re-run
      };

      currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscriptContent = '';
        let interimTranscriptContent = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscriptContent += event.results[i][0].transcript + ' ';
          } else {
            interimTranscriptContent += event.results[i][0].transcript;
          }
        }
        setDictatedText(finalTranscriptContent.trim());
        setInterimTranscript(interimTranscriptContent.trim());
      };

      currentRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error, event.message);
        let errorMsg = `Error: ${event.error}. ${event.message || ''}`;
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          errorMsg = 'Microphone access was denied. Please enable it in your browser settings and try again.';
          setHasMicPermission(false);
        } else if (event.error === 'no-speech') {
          errorMsg = 'No speech detected. Please try again.';
        } else if (event.error === 'audio-capture') {
          errorMsg = 'Microphone not found or is busy. Please check your microphone setup.';
        } else if (event.error === 'network') {
          errorMsg = 'Network error during speech recognition. Please check your connection.';
        }
        setSpeechError(errorMsg);
        setIsListening(false); // Stop listening on error
      };

      currentRecognition.onend = () => {
        setIsListening(false);
        // If there's a final interim transcript, append it to dictated text
        // This happens if recognition stops before the last utterance is finalized
        setDictatedText(prevFinal => {
            const trimmedPrev = prevFinal.trim();
            const trimmedInterim = interimTranscript.trim(); // from state
            if (trimmedInterim) {
                return (trimmedPrev ? trimmedPrev + " " : "") + trimmedInterim;
            }
            return trimmedPrev;
        });
        setInterimTranscript(""); // Clear interim after appending
      };
    } else if (isOpen) { // Only set error if dialog is open and API not supported
        setSpeechError("Speech recognition is not supported by your browser.");
    }

    return () => {
      if (currentRecognition) {
        currentRecognition.onstart = null;
        currentRecognition.onresult = null;
        currentRecognition.onerror = null;
        currentRecognition.onend = null;
        if (isListening) { // Check isListening state before aborting
          currentRecognition.abort();
        }
      }
    };
  }, [isOpen, isListening, dictatedText, interimTranscript, setDictatedText, setInterimTranscript, setIsListening, setSpeechError, setHasMicPermission, toast]);


  const handleStartListening = async () => {
    if (!recognitionRef.current) {
      setSpeechError("Speech recognition not initialized. This can happen if the browser doesn't support it or if there was an initialization error.");
      if (!(typeof window !== 'undefined' && ('SpeechRecognition'in window || 'webkitSpeechRecognition'in window))) {
          setSpeechError("Speech recognition is not supported by your browser.");
      }
      return;
    }
    if (isListening) return;

    if (hasMicPermission === false) { // Explicitly denied
        setSpeechError('Microphone access was denied. Please enable it in your browser settings and try again.');
        return;
    }

    try {
      setSpeechError(null); // Clear previous errors before trying to start
      // Clear texts for a new session when user explicitly clicks "Start Listening"
      setDictatedText(""); 
      setInterimTranscript("");
      recognitionRef.current.start();
      // onstart will set isListening(true)
    } catch (err: any) {
      console.error("Error starting speech recognition:", err);
      let errorDetail = err.message || "Unknown error";
      if (err.name === 'InvalidStateError' && !isListening) { // Specific handling for common issue
          console.warn("Attempting to re-init and start recognition due to InvalidStateError");
          // Potentially re-initialize or simply try starting again after a brief moment.
          // For now, just log and show error.
          setSpeechError(`Could not start microphone (InvalidState): ${errorDetail}. Try again.`);

      } else {
        setSpeechError(`Could not start microphone: ${errorDetail}. Ensure permission is granted.`);
      }
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') setHasMicPermission(false);
      setIsListening(false); // Ensure listening state is false if start fails
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop(); 
      // onend will set isListening(false) and process final interim if any
    }
  };

  const handleProcessDictation = async () => {
    const textToProcess = dictatedText.trim(); // dictatedText should be complete after onend

    if (!textToProcess) {
      toast({ title: "Nothing to process", description: "Please dictate some text first.", variant: "destructive" });
      return;
    }
    setIsProcessingDictation(true);
    try {
      const input: ExtractListFromTextInput = { textToProcess };
      const result = await extractListFromText(input);
      if (result && result.parentListTitle) {
        const newParentList = await addList({ title: result.parentListTitle.trim() });
        if (newParentList && newParentList.id) {
          setListToFocusId(newParentList.id);
          if (result.extractedSubitems && result.extractedSubitems.length > 0) {
            const subitemsToAdd: Subitem[] = result.extractedSubitems
              .filter(si => si.title && si.title.trim() !== "")
              .map(si => ({ id: crypto.randomUUID(), title: si.title.trim(), completed: false }));
            if (subitemsToAdd.length > 0) {
              await manageSubitems(newParentList.id, subitemsToAdd);
            }
          }
        }
        toast({ title: "List Created!", description: `"${result.parentListTitle}" created from your dictation.` });
        onOpenChange(false); // Close dialog on success
      } else {
        toast({ title: "Processing Error", description: "Could not extract a list from the dictated text. Please try rephrasing or check the text.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error processing dictated text with AI:", error);
      toast({ title: "AI Error", description: `Failed to process dictation: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingDictation(false);
    }
  };

  const handleDialogOpeChange = (openState: boolean) => {
    onOpenChange(openState); // Propagate to parent
    if (!openState) {
      // Dialog is closing
      if (recognitionRef.current && isListening) {
        recognitionRef.current.abort(); // Stop listening if active
      }
      setIsListening(false); // Ensure listening state is false
    } else {
      // Dialog is opening
      setDictatedText("");
      setInterimTranscript("");
      setSpeechError(null);
      setHasMicPermission(null); // This triggers permission check / API init in useEffect
       if (!(typeof window !== 'undefined' && ('SpeechRecognition'in window || 'webkitSpeechRecognition'in window))) {
          setSpeechError("Speech recognition is not supported by your browser.");
      }
    }
  };

  const handleClearDictatedText = () => {
    setDictatedText("");
    setInterimTranscript("");
    setSpeechError(null); 
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop(); // This will trigger onend, which sets isListening(false)
    }
  };

  // Display combines final (dictatedText) and current hypothesis (interimTranscript)
  const displayedText = (dictatedText.trim() + (interimTranscript.trim() ? (dictatedText.trim() ? " " : "") + interimTranscript.trim() : "")).trim();

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpeChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dictate New List</DialogTitle>
          <DialogDescription>
            Click "Start Listening" and speak your list title and items. Click "Stop Listening" when done.
            The AI will then process the text to create your list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-center space-x-2">
            {!isListening ? (
              <Button 
                onClick={handleStartListening} 
                disabled={hasMicPermission === false || !recognitionRef.current || isProcessingDictation} 
                className="flex-1"
              >
                <Mic className="mr-2 h-5 w-5" /> Start Listening
              </Button>
            ) : (
              <Button 
                onClick={handleStopListening} 
                variant="destructive" 
                className="flex-1"
                disabled={isProcessingDictation} // Keep stop enabled even if processing (though ideally stop aborts processing)
              >
                <MicOff className="mr-2 h-5 w-5" /> Stop Listening
              </Button>
            )}
            <Button 
              onClick={handleClearDictatedText} 
              variant="outline" 
              size="icon" 
              title="Clear Text" 
              disabled={isProcessingDictation || isListening}
            >
              <Eraser className="h-5 w-5" />
            </Button>
          </div>
          <Textarea
            placeholder={
                isListening ? "Listening..." 
                : speechError ? "Speech recognition error." // Generic if error, specific error shown below
                : hasMicPermission === false ? "Microphone access denied." 
                : !recognitionRef.current ? "Speech recognition not available or not initialized."
                : "Your dictated text will appear here..."
            }
            value={displayedText}
            readOnly={isListening} 
            onChange={(e) => {
              if (!isListening) { 
                setDictatedText(e.target.value); 
                setInterimTranscript(""); 
              }
            }}
            rows={6}
            className="resize-none"
          />
          {speechError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Speech Error</AlertTitle>
              <AlertDescription>{speechError}</AlertDescription>
            </Alert>
          )}
          {/* Redundant with speechError message for permission, but kept for explicit UI hint if no other error exists yet */}
          {hasMicPermission === false && !speechError?.includes("denied") && ( 
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Microphone Access Denied</AlertTitle>
                  <AlertDescription>
                      Please enable microphone permissions in your browser settings to use dictation.
                  </AlertDescription>
              </Alert>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessingDictation || isListening}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleProcessDictation} 
            disabled={isProcessingDictation || isListening || !dictatedText.trim() || !recognitionRef.current}
          >
            {isProcessingDictation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create List from Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


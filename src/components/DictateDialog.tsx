
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
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Ensure to stop listening and clean up if dialog is closed externally
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      setIsListening(false); // Ensure isListening state is false
      return; // Don't initialize if not open
    }

    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) {
        const rec = new SpeechRecognitionAPI();
        rec.continuous = true; // Important for ongoing dictation
        rec.interimResults = true; // Get results as they come
        rec.lang = 'en-US';
        recognitionRef.current = rec;
      }

      const currentRecognition = recognitionRef.current;

      currentRecognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        setDictatedText(""); // Clear previous final transcript
        setInterimTranscript(""); // Clear previous interim transcript
      };

      currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscriptContent = '';
        let interimTranscriptContent = '';

        for (let i = 0; i < event.results.length; i++) {
          const segment = event.results[i];
          const transcript = segment[0].transcript;
          if (segment.isFinal) {
            finalTranscriptContent += transcript;
          } else {
            interimTranscriptContent += transcript;
          }
        }
        
        setDictatedText(finalTranscriptContent);
        setInterimTranscript(interimTranscriptContent);
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
        setIsListening(false);
      };

      currentRecognition.onend = () => {
        setIsListening(false);
        // If there was any final interim text, merge it into the dictatedText.
        // `displayedText` for processing will use this combined state.
        if (interimTranscript.trim()) {
          setDictatedText(prevFinal => (prevFinal + " " + interimTranscript).trim());
        }
        setInterimTranscript(""); // Clear interim for UI for next session
      };

      // Cleanup function for the useEffect
      return () => {
        if (currentRecognition) {
          currentRecognition.onstart = null;
          currentRecognition.onresult = null;
          currentRecognition.onerror = null;
          currentRecognition.onend = null;
          if (isListening) { // Check React state `isListening`
            currentRecognition.stop();
          }
        }
      };
    } else if (isOpen) { // If dialog is open but speech recognition is not supported
        setSpeechError("Speech recognition is not supported by your browser.");
    }
  // Key dependencies: isOpen ensures re-setup if dialog re-opens.
  // State setters are generally stable but good to include.
  // interimTranscript is now read in onend.
  }, [isOpen, isListening, interimTranscript, setIsListening, setSpeechError, setDictatedText, setInterimTranscript, setHasMicPermission, toast]);


  const handleStartListening = async () => {
    if (!recognitionRef.current) {
      setSpeechError("Speech recognition not initialized or not supported.");
      if (!(typeof window !== 'undefined' && ('SpeechRecognition'in window || 'webkitSpeechRecognition'in window))) {
          setSpeechError("Speech recognition is not supported by your browser.");
      }
      return;
    }
    if (isListening) return;

    if (hasMicPermission === false) {
        setSpeechError('Microphone access was denied. Please enable it in your browser settings and try again.');
        return;
    }

    try {
      setSpeechError(null);
      // onstart will clear dictatedText and interimTranscript
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Error starting speech recognition:", err);
      let errorDetail = err.message || "Unknown error";
      if (err.name === 'InvalidStateError' && !isListening) {
          // Attempt to restart if it's in a weird state but not listening
          console.log("Attempting to abort and restart recognition due to InvalidStateError");
          recognitionRef.current.abort(); // Abort previous instance
          recognitionRef.current.start(); // Try starting again
      } else {
        setSpeechError(`Could not start microphone: ${errorDetail}. Ensure permission is granted.`);
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') setHasMicPermission(false);
        setIsListening(false);
      }
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop(); // This will trigger 'onend'
    }
  };

  const handleProcessDictation = async () => {
    const textToProcess = (dictatedText.trim() + (interimTranscript.trim() ? (dictatedText.trim() ? " " : "") + interimTranscript.trim() : "")).trim();

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
        onOpenChange(false); 
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
    onOpenChange(openState); 
    if (!openState) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop(); 
      }
      setIsListening(false); 
    } else {
      // Reset states when dialog is opened, onstart will handle full reset before listening
      setDictatedText("");
      setInterimTranscript("");
      setSpeechError(null);
      setHasMicPermission(null); 
       if (!(typeof window !== 'undefined' && ('SpeechRecognition'in window || 'webkitSpeechRecognition'in window))) {
          setSpeechError("Speech recognition is not supported by your browser.");
      }
    }
  };

  const handleClearDictatedText = () => {
    setDictatedText("");
    setInterimTranscript("");
    setSpeechError(null); // Clear any previous errors
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop(); // Stop listening
      // recognitionRef.current.start(); // Optionally restart listening immediately, or let user click "Start"
    }
  };

  const displayedText = (dictatedText + (interimTranscript ? (dictatedText ? " " : "") + interimTranscript : "")).trim();

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
              <Button onClick={handleStartListening} disabled={hasMicPermission === false || !recognitionRef.current} className="flex-1">
                <Mic className="mr-2 h-5 w-5" /> Start Listening
              </Button>
            ) : (
              <Button onClick={handleStopListening} variant="destructive" className="flex-1">
                <MicOff className="mr-2 h-5 w-5" /> Stop Listening
              </Button>
            )}
            <Button onClick={handleClearDictatedText} variant="outline" size="icon" title="Clear Text" disabled={isProcessingDictation}>
              <Eraser className="h-5 w-5" />
            </Button>
          </div>
          <Textarea
            placeholder={isListening ? "Listening..." : (hasMicPermission === false ? "Microphone access denied." : "Your dictated text will appear here...")}
            value={displayedText}
            readOnly={isListening} 
            onChange={(e) => {
              if (!isListening) { 
                setDictatedText(e.target.value); // Allow manual editing if not listening
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
          {hasMicPermission === false && !speechError && ( /* Only show if no other speechError is active */
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Microphone Access Denied</AlertTitle>
                  <AlertDescription>
                      Please enable microphone permissions in your browser settings to use dictation.
                  </AlertDescription>
              </Alert>
          )}
          {/* Message for browser not supported moved to handleStartListening and handleDialogOpeChange to set speechError state */}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isProcessingDictation || isListening}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleProcessDictation} 
            disabled={isProcessingDictation || isListening || !displayedText.trim() || !recognitionRef.current}
          >
            {isProcessingDictation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create List from Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


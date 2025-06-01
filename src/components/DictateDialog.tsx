
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) {
        const rec = new SpeechRecognitionAPI();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        recognitionRef.current = rec;
      }

      const currentRecognition = recognitionRef.current;

      currentRecognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        // dictatedText is cleared when dialog opens or on clear button press
        setInterimTranscript(""); 
      };

      currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let newFinalTextPortion = "";
        let currentInterim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const segment = event.results[i];
          if (segment.isFinal) {
            newFinalTextPortion += segment[0].transcript;
          } else {
            currentInterim += segment[0].transcript;
          }
        }

        if (newFinalTextPortion.trim()) {
          setDictatedText(prev => (prev.trim() ? prev.trim() + " " : "") + newFinalTextPortion.trim());
        }
        setInterimTranscript(currentInterim);
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
        // If there's a final interim transcript, append it to dictated text.
        // This can happen if speech ends before a final result.
        setInterimTranscript(currentInterim => {
            if (currentInterim.trim()) {
                setDictatedText(prev => (prev.trim() ? prev.trim() + " " : "") + currentInterim.trim());
            }
            return ""; // Clear interim after processing
        });
      };
    }
  // Add all state setters used in the callbacks to the dependency array
  }, [setIsListening, setSpeechError, setInterimTranscript, setDictatedText, setHasMicPermission]);


  const handleStartListening = async () => {
    if (!recognitionRef.current) {
      setSpeechError("Speech recognition not initialized or not supported.");
      return;
    }
    if (isListening) return;

    if (hasMicPermission === false) {
        setSpeechError('Microphone access was denied. Please enable it in your browser settings and try again.');
        return;
    }

    try {
      // dictatedText is cleared on dialog open, or manually by user.
      // No need to clear dictatedText here, to allow append if desired (though current UX clears on open)
      setInterimTranscript(""); 
      setSpeechError(null);
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Error starting speech recognition:", err);
      setSpeechError(`Could not start microphone: ${err.message}. Ensure permission is granted.`);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') setHasMicPermission(false);
      setIsListening(false);
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleProcessDictation = async () => {
    // Use a combined text from dictatedText and any final interimTranscript (which should be processed by onend)
    // However, if Create List is clicked while still listening and there's interim, include it.
    const textToProcess = (dictatedText + (interimTranscript ? (dictatedText.trim() && interimTranscript.trim() ? " " : "") + interimTranscript.trim() : "")).trim();

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
      setInterimTranscript(""); 
      setSpeechError(null);
      setIsListening(false); 
    } else {
      // Clear dictated text when dialog re-opens for a fresh session
      setDictatedText("");
      setInterimTranscript("");
      setSpeechError(null);
      if (!recognitionRef.current && !(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))) {
          setSpeechError("Speech recognition is not supported by your browser.");
      } else {
          setSpeechError(null);
      }
      setHasMicPermission(null); 
    }
  };

  const handleClearDictatedText = () => {
    setDictatedText("");
    setInterimTranscript("");
    setSpeechError(null);
    if (recognitionRef.current && isListening) {
      recognitionRef.current.abort(); // Abort might be better to stop and clear buffers
      // Then restart if desired, or let user restart. For now, just aborts.
      // recognitionRef.current.start(); // if you want to immediately restart
    }
  };


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
            <Button onClick={handleClearDictatedText} variant="outline" size="icon" title="Clear Text" disabled={isListening || isProcessingDictation}>
              <Eraser className="h-5 w-5" />
            </Button>
          </div>
          <Textarea
            placeholder={isListening ? "Listening..." : (hasMicPermission === false ? "Microphone access denied." : "Your dictated text will appear here...")}
            value={dictatedText.trim() + (interimTranscript.trim() ? (dictatedText.trim() && interimTranscript.trim() ? " " : "") + interimTranscript.trim() : "")}
            readOnly={isListening && interimTranscript.length > 0} 
            onChange={(e) => {
              if (!isListening) {
                setDictatedText(e.target.value);
                if (interimTranscript) setInterimTranscript(""); 
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
          {hasMicPermission === false && !speechError && (
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Microphone Access Denied</AlertTitle>
                  <AlertDescription>
                      Please enable microphone permissions in your browser settings to use dictation.
                  </AlertDescription>
              </Alert>
          )}
          {!recognitionRef.current && typeof window !== 'undefined' && !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && !speechError && (
              <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Browser Not Supported</AlertTitle>
                  <AlertDescription>
                      Speech recognition is not supported by your current browser.
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
            disabled={isProcessingDictation || isListening || !(dictatedText.trim() || interimTranscript.trim()) || !recognitionRef.current}
          >
            {isProcessingDictation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create List from Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

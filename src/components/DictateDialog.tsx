
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

  // Effect to initialize SpeechRecognition instance
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!recognitionRef.current) { // Initialize only once
        const rec = new SpeechRecognitionAPI();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
          // Do not clear dictatedText here, allow appending across stop/start if desired by user
          // Interim transcript should be cleared for a new listening session segment
          setInterimTranscript(""); 
        };

        rec.onresult = (event) => {
          let currentFinalTranscript = "";
          let currentInterimTranscript = "";

          for (let i = 0; i < event.results.length; i++) {
            const segment = event.results[i];
            // If the segment is final, append its transcript to currentFinalTranscript
            if (segment.isFinal) {
              currentFinalTranscript += segment[0].transcript + ' ';
            } else {
              // Otherwise, append to currentInterimTranscript
              currentInterimTranscript += segment[0].transcript;
            }
          }
          
          // Update dictatedText with the full final transcript from this session, trimmed.
          // This replaces the previous dictatedText with the new complete final version.
          if (currentFinalTranscript.trim()) {
            setDictatedText(currentFinalTranscript.trim());
          } else if (event.results.length > 0 && event.results[0].isFinal && currentFinalTranscript.trim() === "" && dictatedText !== "") {
            // If the very first result of a new session is final and empty (e.g. silence),
            // and there was previous dictated text, this logic might clear it.
            // This might need adjustment if we want to append across manual stop/start actions.
            // For now, this rebuilds from scratch for the current active listening session.
            // If dictatedText was "A B" and new final is "", dictatedText becomes "".
            // If dictatedText was "A B" and new final is "C", dictatedText becomes "C".
            // If user wants to append, they should use the clear button less often.
          }
          
          // Update interimTranscript with all non-final parts.
          setInterimTranscript(currentInterimTranscript);
        };

        rec.onerror = (event) => {
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

        rec.onend = () => {
          setIsListening(false);
          // Consider if interimTranscript should be appended to dictatedText here if it's non-empty
          // For now, let's assume final results are the primary source for dictatedText.
          // If there's remaining interim text, it might mean the user stopped speaking mid-word.
          // The current behavior is that it will just disappear from the textarea display once listening stops.
          // To append it:
          // if (interimTranscript.trim()) {
          //   setDictatedText(prev => (prev ? prev + " " : "") + interimTranscript.trim());
          // }
          setInterimTranscript(""); // Clear interim when listening truly ends
        };
        recognitionRef.current = rec;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount


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
      // Don't clear dictatedText here, allow user to append if they stop/start.
      // They can use the clear button if they want a fresh start.
      setInterimTranscript(""); // Clear any stale interim text
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
    const textToProcess = (dictatedText + (interimTranscript ? (dictatedText ? " " : "") + interimTranscript : "")).trim();
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
    onOpenChange(openState); // Call parent's handler
    if (!openState) {
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      // Don't clear dictatedText when dialog closes, user might want to reopen and continue.
      setInterimTranscript(""); // Clear interim transcript.
      setSpeechError(null);
      setIsListening(false); // Ensure listening state is reset.
    } else {
      // Check support on dialog open
      if (!recognitionRef.current && !(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))) {
          setSpeechError("Speech recognition is not supported by your browser.");
      } else {
          setSpeechError(null);
      }
      setHasMicPermission(null); // Reset permission check on open
    }
  };

  const handleClearDictatedText = () => {
    setDictatedText("");
    setInterimTranscript("");
    setSpeechError(null);
    // If listening, stop and restart to clear internal buffer of recognizer as well
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      // A short delay might be needed before restarting, or simply stop and let user restart.
      // For simplicity, just stop. User can click "Start Listening" again.
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
            value={dictatedText + (interimTranscript ? (dictatedText && interimTranscript ? " " : "") + interimTranscript : "")}
            readOnly={isListening && interimTranscript.length > 0} // Allow editing if not actively listening or no interim
            onChange={(e) => {
              if (!isListening) {
                setDictatedText(e.target.value);
                if (interimTranscript) setInterimTranscript(""); // Clear interim if user manually edits
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


      
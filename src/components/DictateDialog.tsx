
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
      if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

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
        setDictatedText(""); 
        setInterimTranscript(""); 
      };

      currentRecognition.onresult = (event: SpeechRecognitionEvent) => {
        let final_transcript_from_event = '';
        let interim_transcript_from_event = '';

        for (let i = 0; i < event.results.length; ++i) {
          const transcript_part = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final_transcript_from_event += transcript_part;
          } else {
            interim_transcript_from_event += transcript_part;
          }
        }
        setDictatedText(final_transcript_from_event.trim());
        setInterimTranscript(interim_transcript_from_event.trim());
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
        // dictatedText state should have the full final part from the last onresult.
        // interimTranscript state should have the full interim part from the last onresult.
        // If interimTranscript (state) is not empty, it means the last utterance wasn't finalized.
        if (interimTranscript.trim()) {
            setDictatedText(prevFinal => {
                const trimmedPrev = prevFinal.trim();
                const trimmedInterim = interimTranscript.trim(); // from state
                if (trimmedPrev && trimmedInterim) {
                    return (trimmedPrev + " " + trimmedInterim).trim();
                } else if (trimmedInterim) {
                    return trimmedInterim;
                }
                return trimmedPrev;
            });
        }
        setInterimTranscript(""); 
      };
      
      return () => {
        if (currentRecognition) {
          currentRecognition.onstart = null;
          currentRecognition.onresult = null;
          currentRecognition.onerror = null;
          currentRecognition.onend = null;
          if (isListening) { 
            currentRecognition.abort(); // Use abort for immediate stop
          }
        }
      };
    } else if (isOpen) { 
        setSpeechError("Speech recognition is not supported by your browser.");
    }
  }, [isOpen, isListening, dictatedText, interimTranscript, setIsListening, setSpeechError, setDictatedText, setInterimTranscript, setHasMicPermission, toast]);


  const handleStartListening = async () => {
    if (!recognitionRef.current) {
      setSpeechError("Speech recognition not initialized.");
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
      // onstart will clear dictatedText and interimTranscript for a new session
      setDictatedText(""); 
      setInterimTranscript("");
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Error starting speech recognition:", err);
      let errorDetail = err.message || "Unknown error";
      if (err.name === 'InvalidStateError' && !isListening) {
          console.log("Attempting to abort and restart recognition due to InvalidStateError");
          recognitionRef.current.abort(); 
          setDictatedText(""); 
          setInterimTranscript("");
          recognitionRef.current.start(); 
      } else {
        setSpeechError(`Could not start microphone: ${errorDetail}. Ensure permission is granted.`);
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') setHasMicPermission(false);
        setIsListening(false);
      }
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop(); 
    }
  };

  const handleProcessDictation = async () => {
    // dictatedText should be complete after onend. interimTranscript should be empty.
    const textToProcess = dictatedText.trim();

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
        recognitionRef.current.abort(); 
      }
      setIsListening(false); 
    } else {
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
    setSpeechError(null); 
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop(); 
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
              <Button onClick={handleStartListening} disabled={hasMicPermission === false || !recognitionRef.current} className="flex-1">
                <Mic className="mr-2 h-5 w-5" /> Start Listening
              </Button>
            ) : (
              <Button onClick={handleStopListening} variant="destructive" className="flex-1">
                <MicOff className="mr-2 h-5 w-5" /> Stop Listening
              </Button>
            )}
            <Button onClick={handleClearDictatedText} variant="outline" size="icon" title="Clear Text" disabled={isProcessingDictation || isListening}>
              <Eraser className="h-5 w-5" />
            </Button>
          </div>
          <Textarea
            placeholder={isListening ? "Listening..." : (hasMicPermission === false ? "Microphone access denied." : "Your dictated text will appear here...")}
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
          {hasMicPermission === false && !speechError && (
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


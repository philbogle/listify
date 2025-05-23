
"use client";

import TaskCard from "@/components/TaskCard";
import { useTasks } from "@/hooks/useTasks";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ListChecks, AlertTriangle, Plus, Camera, Loader2, RefreshCw } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useEffect, useState, useRef, useCallback } from "react";
import type { Task, Subtask } from "@/types/task";
import Image from "next/image"; 
import { useToast } from "@/hooks/use-toast"; 
import { extractTasksFromImage, type ExtractTasksFromImageInput } from "@/ai/flows/extractTasksFromImageFlow";


const fileToDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function Home() {
  const { tasks, isLoading, addTask, updateTask, deleteTask, manageSubtasks } = useTasks();
  const [firebaseReady, setFirebaseReady] = useState(false);
  
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const { toast } = useToast();

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [taskToFocusId, setTaskToFocusId] = useState<string | null>(null);


  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
  }, []);

  const stopCameraStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  useEffect(() => {
    if (isImportDialogOpen && hasCameraPermission === null) { 
      const getCameraPermission = async () => {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setStream(mediaStream);
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
        }
      };
      getCameraPermission();
    } else if (!isImportDialogOpen && stream) {
      stopCameraStream();
    }

    return () => {
      if (stream && !isImportDialogOpen ) { 
         stopCameraStream();
      }
    };
  }, [isImportDialogOpen, hasCameraPermission, stream, stopCameraStream, toast]);


  const handleAddNewTask = async () => {
    const newTask = await addTask({ title: "Untitled Task" }); // Add with a placeholder title
    if (newTask && newTask.id) {
      setTaskToFocusId(newTask.id); // Set this task to be focused for editing
    }
  };
  
  const handleInitialEditDone = (taskId: string) => {
    if (taskId === taskToFocusId) {
      setTaskToFocusId(null); // Clear the focus state once editing has commenced
    }
  };

  const handleCaptureImage = async () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;
    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
        setIsCapturing(false);
        return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
        if (blob) {
            const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setCapturedImageFile(capturedFile);
            const previewUrl = URL.createObjectURL(capturedFile);
            setImagePreviewUrl(previewUrl);
            stopCameraStream(); 
        }
        setIsCapturing(false);
    }, 'image/jpeg', 0.9); 
  };


  const resetImportDialog = useCallback(() => {
    setCapturedImageFile(null);
    setImagePreviewUrl(null);
    stopCameraStream();
    setHasCameraPermission(null); 
    setIsImportDialogOpen(false);
  }, [stopCameraStream]);

  const handleExtractTasks = async () => {
    if (!capturedImageFile) {
      return;
    }

    setIsProcessingImage(true);
    try {
      const imageDataUri = await fileToDataUri(capturedImageFile);
      const input: ExtractTasksFromImageInput = { imageDataUri };
      const result = await extractTasksFromImage(input);

      if (result && result.parentTaskTitle) {
        const parentTitle = result.parentTaskTitle.trim();
        
        if (parentTitle.toLowerCase().includes("no list found") || parentTitle.toLowerCase().includes("not a list")) {
          resetImportDialog();
          setIsProcessingImage(false);
          return;
        }

        const newParentTask = await addTask({ title: parentTitle });

        if (newParentTask && newParentTask.id) {
          if (result.extractedSubtasks && result.extractedSubtasks.length > 0) {
            const subtasksToAdd: Subtask[] = result.extractedSubtasks
              .filter(st => st.title && st.title.trim() !== "")
              .map(st => ({
                id: crypto.randomUUID(),
                title: st.title.trim(),
                completed: false,
              }));

            if (subtasksToAdd.length > 0) {
              await manageSubtasks(newParentTask.id, subtasksToAdd);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error extracting tasks from image:", error);
      toast({ title: "Import Error", description: "An unexpected error occurred while processing the image.", variant: "destructive" });
    } finally {
      setIsProcessingImage(false);
      resetImportDialog();
    }
  };
  
  const renderTasks = () => {
    if (isLoading && !isFirebaseConfigured() && tasks.length === 0) { 
      return Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="mb-4 p-4 border rounded-lg shadow-md bg-card">
          <div className="flex items-center space-x-3 mb-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-4/5" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ));
    }
    
    if (tasks.length === 0 && !isLoading) {
      return (
        <div className="text-center py-10">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tasks yet. Add one or scan a list to get started!</p>
        </div>
      );
    }

    return tasks.map((task) => (
      <TaskCard
        key={task.id}
        task={task}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onManageSubtasks={manageSubtasks}
        startInEditMode={task.id === taskToFocusId}
        onInitialEditDone={handleInitialEditDone}
      />
    ));
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 relative">
      {!firebaseReady && !isLoading && (
        <div className="w-full max-w-2xl mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 rounded-md flex items-start" role="alert">
          <AlertTriangle className="h-5 w-5 mr-3 mt-0.5"/>
          <div>
            <p className="font-bold">Firebase Not Configured</p>
            <p className="text-sm">
              Your tasks are currently saved locally. For cloud storage and sync, please configure Firebase in 
              <code className="text-xs bg-yellow-200 p-0.5 rounded">src/lib/firebaseConfig.ts</code>.
            </p>
          </div>
        </div>
      )}
      
      <main className="w-full max-w-2xl grid grid-cols-1 gap-10 mt-2"> {/* Reduced mt-8 to mt-2 */}
         <section aria-labelledby="task-list-heading" className="mt-2">
          <div className="flex justify-between items-center mb-6">
            <h2 id="task-list-heading" className="text-2xl font-semibold text-center sm:text-left">Your Tasks</h2>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleAddNewTask}>
                <Plus className="mr-2 h-4 w-4" /> Add Task
              </Button>
              <Dialog open={isImportDialogOpen} onOpenChange={(isOpen) => {
                setIsImportDialogOpen(isOpen);
                if (!isOpen) { 
                  resetImportDialog();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Camera className="mr-2 h-4 w-4" /> 
                    Scan
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                  <DialogHeader>
                    <DialogTitle>Scan Handwritten List</DialogTitle>
                    <DialogDescription>
                      Take a picture of your handwritten task list. The AI will create a new list with these items.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="space-y-4">
                      <div className="w-full aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center">
                        <video ref={videoRef} className={`w-full h-full object-cover ${!stream || imagePreviewUrl ? 'hidden' : ''}`} autoPlay playsInline muted />
                        {hasCameraPermission === false && (
                           <Alert variant="destructive" className="m-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Camera Access Denied</AlertTitle>
                            <AlertDescription>
                              Please allow camera access in your browser settings to use this feature. You might need to refresh the page after granting permission.
                            </AlertDescription>
                          </Alert>
                        )}
                        {hasCameraPermission === null && !stream && <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />}
                      </div>
                       {stream && !imagePreviewUrl && hasCameraPermission &&(
                        <Button onClick={handleCaptureImage} disabled={isCapturing || !stream} className="w-full">
                          {isCapturing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                          {isCapturing ? "Capturing..." : "Capture Photo"}
                        </Button>
                      )}
                      {imagePreviewUrl && ( 
                        <Button onClick={() => {setImagePreviewUrl(null); setCapturedImageFile(null); setHasCameraPermission(null);}} variant="outline" className="w-full">
                            <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                        </Button>
                      )}
                    </div>
                    
                    {imagePreviewUrl && capturedImageFile && ( 
                      <div className="mt-4 border rounded-md overflow-hidden max-h-60 flex justify-center items-center bg-muted/20">
                         <Image src={imagePreviewUrl} alt="Preview" width={400} height={240} style={{ objectFit: 'contain', maxHeight: '240px', width: 'auto' }} data-ai-hint="handwritten list"/>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleExtractTasks} disabled={!capturedImageFile || isProcessingImage}>
                      {isProcessingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isProcessingImage ? "Processing..." : "Extract & Add List"}
                    </Button>
                  </DialogFooter>
                  <canvas ref={canvasRef} className="hidden"></canvas>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-4">
            {renderTasks()}
          </div>
        </section>
      </main>

      <footer className="w-full max-w-3xl mt-16 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TaskFlow. Built with Next.js and Firebase.</p>
      </footer>
    </div>
  );
}

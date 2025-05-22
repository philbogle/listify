
"use client";

import TaskForm from "@/components/TaskForm";
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
import { Input } from "@/components/ui/input"; // Added for file input
import { Label } from "@/components/ui/label"; // Added for file input styling
import { ListChecks, AlertTriangle, Plus, ImageUp, Loader2 } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useEffect, useState, useRef } from "react";
import type { Task } from "@/types/task";
import Image from "next/image"; // For image preview
import { useToast } from "@/hooks/use-toast"; // For feedback
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
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();


  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
  }, []);

  const handleTaskAdded = () => {
    setIsFormDialogOpen(false);
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreviewUrl(previewUrl);
    } else {
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
    }
  };

  const handleExtractTasks = async () => {
    if (!selectedImageFile) {
      toast({ title: "No Image", description: "Please select an image first.", variant: "destructive" });
      return;
    }

    setIsProcessingImage(true);
    try {
      const imageDataUri = await fileToDataUri(selectedImageFile);
      const input: ExtractTasksFromImageInput = { imageDataUri };
      const result = await extractTasksFromImage(input);

      if (result.extractedTasks && result.extractedTasks.length > 0) {
        for (const task of result.extractedTasks) {
          if (task.title && task.title.trim() !== "") {
            await addTask({ title: task.title.trim() }); // addTask already shows a toast
          }
        }
        toast({ title: "Import Successful", description: `${result.extractedTasks.length} tasks were processed from the image.` });
      } else {
        toast({ title: "No Tasks Found", description: "The AI could not find any tasks in the image.", variant: "default" });
      }
    } catch (error) {
      console.error("Error extracting tasks from image:", error);
      toast({ title: "Import Error", description: "Could not extract tasks from the image.", variant: "destructive" });
    } finally {
      setIsProcessingImage(false);
      setIsImportDialogOpen(false);
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
    }
  };
  
  const renderTasks = () => {
    if (isLoading && !isFirebaseConfigured() && tasks.length === 0) { // Show skeleton only on initial load if no local tasks
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
          <p className="text-muted-foreground">No tasks yet. Add one or import from an image to get started!</p>
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
      
      <main className="w-full max-w-2xl grid grid-cols-1 gap-10 mt-8">
        <section aria-labelledby="task-list-heading" className="mt-2">
          <div className="flex justify-between items-center mb-6">
            <h2 id="task-list-heading" className="text-2xl font-semibold text-center sm:text-left">Your Tasks</h2>
            <Dialog open={isImportDialogOpen} onOpenChange={(isOpen) => {
              setIsImportDialogOpen(isOpen);
              if (!isOpen) { // Reset on close
                setSelectedImageFile(null);
                setImagePreviewUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ImageUp className="mr-2 h-4 w-4" />
                  Import from Image
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Import Tasks from Image</DialogTitle>
                  <DialogDescription>
                    Upload an image of your handwritten task list. The AI will try to extract the tasks.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid w-full max-w-sm items-center gap-1.5">
                    <Label htmlFor="picture">Picture of your list</Label>
                    <Input 
                      id="picture" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange}
                      ref={fileInputRef}
                      className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                  </div>
                  {imagePreviewUrl && (
                    <div className="mt-4 border rounded-md overflow-hidden max-h-60 flex justify-center items-center bg-muted/20">
                       <Image src={imagePreviewUrl} alt="Preview" width={400} height={240} style={{ objectFit: 'contain', maxHeight: '240px', width: 'auto' }} data-ai-hint="image preview"/>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleExtractTasks} disabled={!selectedImageFile || isProcessingImage}>
                    {isProcessingImage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isProcessingImage ? "Processing..." : "Extract & Add Tasks"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            {renderTasks()}
          </div>
        </section>
      </main>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-8 right-8 h-18 w-18 rounded-full shadow-xl"
            size="icon"
            aria-label="Add new task"
          >
            <Plus className="h-9 w-9" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Fill in the details for your new task. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <TaskForm 
            onSubmit={async (data: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">) => {
              await addTask(data);
            }} 
            onTaskAdded={handleTaskAdded} 
          />
        </DialogContent>
      </Dialog>


      <footer className="w-full max-w-3xl mt-16 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TaskFlow. Built with Next.js and Firebase.</p>
      </footer>
    </div>
  );
}

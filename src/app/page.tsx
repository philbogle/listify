
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
import { ListChecks, AlertTriangle, Plus } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useEffect, useState } from "react";
import type { Task } from "@/types/task";


export default function Home() {
  const { tasks, isLoading, addTask, updateTask, deleteTask, manageSubtasks } = useTasks();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);

  useEffect(() => {
    setFirebaseReady(isFirebaseConfigured());
  }, []);

  const handleTaskAdded = () => {
    setIsFormDialogOpen(false);
  };

  const renderTasks = () => {
    if (isLoading) {
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

    if (tasks.length === 0) {
      return (
        <div className="text-center py-10">
          <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No tasks yet. Add one to get started!</p>
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
      <header className="w-full max-w-3xl mb-8 text-center">
        <div className="flex items-center justify-center space-x-3">
          <ListChecks className="h-10 w-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">TaskFlow</h1>
        </div>
        <p className="text-muted-foreground mt-2">Organize your work, simplify your life.</p>
      </header>

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
      
      <main className="w-full max-w-2xl grid grid-cols-1 gap-10">
        {/* TaskForm removed from here */}
        <section aria-labelledby="task-list-heading" className="mt-2">
          <h2 id="task-list-heading" className="text-2xl font-semibold mb-6 text-center sm:text-left">Your Tasks</h2>
          <div className="space-y-4">
            {renderTasks()}
          </div>
        </section>
      </main>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogTrigger asChild>
          <Button
            className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-xl"
            size="icon"
            aria-label="Add new task"
          >
            <Plus className="h-8 w-8" />
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
          {/* Footer can be removed if TaskForm handles its own submit button */}
        </DialogContent>
      </Dialog>


      <footer className="w-full max-w-3xl mt-16 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} TaskFlow. Built with Next.js and Firebase.</p>
      </footer>
    </div>
  );
}

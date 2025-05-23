
"use client";

import type { FC } from "react";
import { useState, useEffect } from "react";
import type { Task, Subtask } from "@/types/task";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
import { FileText, Plus, Save, X, MoreVertical } from "lucide-react"; 
import SubtaskItem from "./SubtaskItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onManageSubtasks: (taskId: string, newSubtasks: Subtask[]) => Promise<void>;
  startInEditMode?: boolean;
  onInitialEditDone?: (taskId: string) => void;
}

const TaskCard: FC<TaskCardProps> = ({ task, onUpdateTask, onDeleteTask, onManageSubtasks, startInEditMode = false, onInitialEditDone }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description || "");

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      if (onInitialEditDone) {
        onInitialEditDone(task.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInEditMode, task.id]); 

  const handleToggleComplete = (completed: boolean) => {
    onUpdateTask(task.id, { completed });
  };

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim() === "") return;
    const newSubtask: Subtask = {
      id: crypto.randomUUID(), 
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    onManageSubtasks(task.id, [...task.subtasks, newSubtask]);
    setNewSubtaskTitle("");
  };

  const handleToggleSubtaskComplete = (subtaskId: string, completed: boolean) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed } : st
    );
    onManageSubtasks(task.id, updatedSubtasks);
  };
  
  const handleDeleteSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);
    onManageSubtasks(task.id, updatedSubtasks);
  };

  const handleUpdateSubtaskTitle = (subtaskId: string, newTitle: string) => {
    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, title: newTitle } : st
    );
    onManageSubtasks(task.id, updatedSubtasks);
  };

  const handleEdit = () => {
    setEditedTitle(task.title); 
    setEditedDescription(task.description || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (task.title === "Untitled Task" && editedTitle === "Untitled Task" && (editedDescription === "" || !editedDescription)) {
        onDeleteTask(task.id);
    } else {
        setEditedTitle(task.title);
        setEditedDescription(task.description || "");
    }
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (editedTitle.trim() === "") {
        if (task.title === "Untitled Task" && startInEditMode) {
            onDeleteTask(task.id);
            setIsEditing(false);
            return;
        }
        setEditedTitle(task.title || "Untitled Task"); 
    }
    await onUpdateTask(task.id, {
      title: editedTitle.trim() === "" ? (task.title || "Untitled Task") : editedTitle.trim(), 
      description: editedDescription.trim(), 
    });
    setIsEditing(false);
  };


  return (
    <Card className={`mb-4 shadow-lg transition-all duration-300 ${task.completed ? "opacity-70 bg-secondary/30" : "bg-card"}`}>
      <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-3">
        <div className="flex items-center space-x-3 flex-grow min-w-0">
          <Checkbox
            id={`task-${task.id}`}
            checked={task.completed}
            onCheckedChange={(checked) => handleToggleComplete(!!checked)}
            className="h-6 w-6 flex-shrink-0"
            aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
          />
          {isEditing ? (
             <Input 
                value={editedTitle} 
                onChange={(e) => setEditedTitle(e.target.value)} 
                className="text-xl font-semibold leading-none tracking-tight h-9 flex-grow"
                autoFocus
                onBlur={handleSaveEdit} 
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
              />
          ) : (
            <CardTitle 
              className={`text-xl font-semibold leading-none tracking-tight cursor-pointer truncate ${task.completed ? "line-through" : ""}`}
              onClick={handleEdit}
              title={task.title} 
            >
              {task.title}
            </CardTitle>
          )}
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" onClick={handleSaveEdit} className="h-8 w-8" aria-label="Save changes">
                <Save className="h-5 w-5 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-8 w-8" aria-label="Cancel editing">
                <X className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDeleteTask(task.id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-4 space-y-4">
        {isEditing ? (
          <>
            <div className="space-y-1">
              <label htmlFor={`edit-desc-${task.id}`} className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea 
                id={`edit-desc-${task.id}`}
                value={editedDescription} 
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="Task description"
                className="min-h-[60px]"
              />
            </div>
          </>
        ) : (
          <>
            {(task.description || (task.description === "" && isEditing)) && ( 
              <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="whitespace-pre-wrap">{task.description || <span className="italic">No description</span>}</p>
              </div>
            )}
          </>
        )}
        
        {task.subtasks.length > 0 && (
          <div className="space-y-1 pt-2">
            <div className="pl-2 space-y-0.5"> 
              {task.subtasks.map((subtask) => (
                <SubtaskItem
                  key={subtask.id}
                  subtask={subtask}
                  onToggleComplete={handleToggleSubtaskComplete}
                  onDelete={handleDeleteSubtask}
                  onUpdateTitle={handleUpdateSubtaskTitle}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {!task.completed && (
         <CardFooter className="pt-2 pb-4 border-t">
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="Add a subtask..."
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              className="h-9"
            />
            <Button onClick={handleAddSubtask} variant="outline" size="sm" aria-label="Add subtask">
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default TaskCard;


"use client";

import type { FC } from "react";
import { useState, useEffect } from "react";
import type { Task, Subtask } from "@/types/task";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // For editing description
import { CalendarDays, FileText, Plus, Save, Trash2, X } from "lucide-react";
import SubtaskItem from "./SubtaskItem";
import { format, parseISO } from "date-fns";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Calendar } from "./ui/calendar";
// Separator removed from imports

interface TaskCardProps {
  task: Task;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onManageSubtasks: (taskId: string, newSubtasks: Subtask[]) => Promise<void>;
}

const TaskCard: FC<TaskCardProps> = ({ task, onUpdateTask, onDeleteTask, onManageSubtasks }) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const [editedDescription, setEditedDescription] = useState(task.description || "");
  const [editedDueDate, setEditedDueDate] = useState<Date | undefined>(
    task.dueDate ? parseISO(task.dueDate) : undefined
  );

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
    setEditedTitle(task.title); // Reset to current task title when starting edit
    setEditedDescription(task.description || "");
    setEditedDueDate(task.dueDate ? parseISO(task.dueDate) : undefined);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedTitle(task.title);
    setEditedDescription(task.description || "");
    setEditedDueDate(task.dueDate ? parseISO(task.dueDate) : undefined);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (editedTitle.trim() === "") {
        // Optionally, add a toast message here if title is required
        setEditedTitle(task.title); // Revert to original title if empty
        setIsEditing(false);
        return;
    }
    await onUpdateTask(task.id, {
      title: editedTitle.trim(), // Ensure to trim
      description: editedDescription.trim(), // Ensure to trim
      dueDate: editedDueDate ? editedDueDate.toISOString() : undefined,
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
                onBlur={handleSaveEdit} // Save on blur
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
              />
          ) : (
            <CardTitle 
              className={`text-xl font-semibold leading-none tracking-tight cursor-pointer truncate ${task.completed ? "line-through" : ""}`}
              onClick={handleEdit}
              title={task.title} // Show full title on hover for truncated text
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
            <>
              {/* Edit button removed, click on title to edit */}
              <Button variant="ghost" size="icon" onClick={() => onDeleteTask(task.id)} className="h-8 w-8 text-destructive hover:text-destructive" aria-label="Delete task">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
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
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${
                      !editedDueDate ? "text-muted-foreground" : ""
                    }`}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {editedDueDate ? format(editedDueDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editedDueDate}
                    onSelect={setEditedDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </>
        ) : (
          <>
            {(task.description || (task.description === "" && isEditing)) && ( // Show even if empty when editing, else only if content
              <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="whitespace-pre-wrap">{task.description || <span className="italic">No description</span>}</p>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>Due: {format(parseISO(task.dueDate), "PPP")}</span>
              </div>
            )}
          </>
        )}
        
        {task.subtasks.length > 0 && (
          <div className="space-y-1 pt-2">
            <div className="pl-2 space-y-0.5"> {/* Removed max-h-48, overflow-y-auto, pr-1 */}
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

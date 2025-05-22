
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, X } from "lucide-react"; // Removed Edit3
import type { Subtask } from "@/types/task";
import { useState } from "react";

interface SubtaskItemProps {
  subtask: Subtask;
  onToggleComplete: (subtaskId: string, completed: boolean) => void;
  onDelete: (subtaskId: string) => void;
  onUpdateTitle: (subtaskId: string, newTitle: string) => void;
}

const SubtaskItem: FC<SubtaskItemProps> = ({ subtask, onToggleComplete, onDelete, onUpdateTitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(subtask.title);

  const handleStartEdit = () => {
    setEditedTitle(subtask.title); // Reset to current title before editing
    setIsEditing(true);
  };

  const handleUpdateTitle = () => {
    if (editedTitle.trim() !== "" && editedTitle.trim() !== subtask.title) {
      onUpdateTitle(subtask.id, editedTitle.trim());
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setEditedTitle(subtask.title);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group">
      <Checkbox
        id={`subtask-${subtask.id}`}
        checked={subtask.completed}
        onCheckedChange={(checked) => onToggleComplete(subtask.id, !!checked)}
        aria-label={subtask.completed ? "Mark subtask as incomplete" : "Mark subtask as complete"}
        className="flex-shrink-0"
      />
      {isEditing ? (
        <Input 
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="flex-grow h-8 text-sm"
          autoFocus
          onBlur={handleUpdateTitle} // Save on blur
          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTitle(); if (e.key === 'Escape') handleCancelEdit(); }}
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`flex-grow text-sm cursor-pointer truncate ${subtask.completed ? "line-through text-muted-foreground" : ""}`}
          title={subtask.title} // Show full title on hover for truncated text
        >
          {subtask.title}
        </span>
      )}
      
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdateTitle} aria-label="Save subtask title">
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit} aria-label="Cancel editing subtask title">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          // Edit button removed, click on title text to edit
          null 
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(subtask.id)} aria-label="Delete subtask">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SubtaskItem;

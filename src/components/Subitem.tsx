
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, X, MoreVertical } from "lucide-react";
import type { Subitem } from "@/types/list";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SubitemProps {
  subitem: Subitem;
  onToggleComplete: (subitemId: string, completed: boolean) => void;
  onDelete: (subitemId: string) => void;
  onUpdateTitle: (subitemId: string, newTitle: string) => void;
}

const SubitemComponent: FC<SubitemProps> = ({ subitem, onToggleComplete, onDelete, onUpdateTitle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(subitem.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditedTitle(subitem.title);
    setIsEditing(true);
  };

  const handleUpdateTitle = () => {
    if (editedTitle.trim() !== "" && editedTitle.trim() !== subitem.title) {
      onUpdateTitle(subitem.id, editedTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(subitem.title);
    setIsEditing(false);
  };

  return (
    <div className="flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group">
      <Checkbox
        id={`subitem-${subitem.id}`}
        checked={subitem.completed}
        onCheckedChange={(checked) => onToggleComplete(subitem.id, !!checked)}
        onClick={(e) => e.stopPropagation()}
        aria-label={subitem.completed ? "Mark item as incomplete" : "Mark item as complete"}
        className="flex-shrink-0 h-5 w-5"
      />

      <div className="flex-grow min-w-0">
        {isEditing ? (
          <Input
            ref={titleInputRef}
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="h-8 text-sm w-full"
            autoFocus
            onBlur={handleUpdateTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTitle(); if (e.key === 'Escape') handleCancelEdit(); }}
          />
        ) : (
          <span
            onClick={handleStartEdit}
            className={`block text-sm cursor-pointer truncate ${subitem.completed ? "line-through text-muted-foreground" : ""}`}
            title={subitem.title}
          >
            {subitem.title}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1 flex-shrink-0">
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdateTitle} aria-label="Save subitem title">
              <Save className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit} aria-label="Cancel editing subitem title">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onDelete(subitem.id)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export default SubitemComponent;

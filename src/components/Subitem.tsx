
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, X, MoreVertical, Edit3, CheckCircle2, Circle } from "lucide-react";
import type { Subitem } from "@/types/list";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SubitemProps {
  subitem: Subitem;
  onToggleComplete: (subitemId: string, completed: boolean) => void;
  onDelete: (subitemId: string) => void;
  onUpdateTitle: (subitemId: string, newTitle: string) => void;
  startInEditMode?: boolean;
  onInitialEditDone?: (subitemId: string) => void;
  isHighlighted?: boolean;
}

const SubitemComponent: FC<SubitemProps> = ({ subitem, onToggleComplete, onDelete, onUpdateTitle, startInEditMode = false, onInitialEditDone, isHighlighted = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(subitem.title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      if (onInitialEditDone) {
        onInitialEditDone(subitem.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startInEditMode]);


  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      requestAnimationFrame(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditedTitle(subitem.title);
    setIsEditing(true);
  };

  const handleUpdateTitle = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle === "" && subitem.title === "Untitled Item" && startInEditMode) {
        onDelete(subitem.id); 
    } else if (trimmedTitle !== "" && trimmedTitle !== subitem.title) {
      onUpdateTitle(subitem.id, trimmedTitle);
    } else if (trimmedTitle === "" && subitem.title !== "Untitled Item") {
      setEditedTitle(subitem.title);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (subitem.title === "Untitled Item" && editedTitle === "Untitled Item" && startInEditMode) {
        onDelete(subitem.id);
    } else {
        setEditedTitle(subitem.title);
    }
    setIsEditing(false);
  };


  return (
    <div
      className={cn(
        "flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group",
        isHighlighted && "animate-item-appear"
      )}
    >
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
            className={`block text-sm truncate ${subitem.completed ? "line-through text-muted-foreground" : ""}`}
            title={subitem.title}
          >
            {subitem.title}
          </span>
        )}
      </div>

      <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdateTitle} aria-label="Save subitem title">
              <Save className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit} aria-label="Cancel editing subitem title">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More options for subitem" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleComplete(subitem.id, !subitem.completed);
                  }}
                >
                  {subitem.completed ? <Circle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {subitem.completed ? "Mark as Incomplete" : "Mark as Complete"}
                </DropdownMenuItem>
                 <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit();
                  }}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(subitem.id);
                  }}
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

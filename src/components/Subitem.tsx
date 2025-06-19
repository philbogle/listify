
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea"; // Changed from Input
import { Trash2, Save, X, MoreVertical, Edit3, CheckCircle2, Circle } from "lucide-react";
import type { Subitem } from "@/types/list";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator, // Added import
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SubitemProps {
  subitem: Subitem;
  onToggleComplete: (subitemId: string, completed: boolean) => void;
  onDelete: (subitemId: string) => void;
  onUpdateTitle: (subitemId: string, newTitle: string) => void;
  startInEditMode?: boolean;
  onInitialEditDone?: (subitemId: string) => void;
}

const SubitemComponent: FC<SubitemProps> = ({ subitem, onToggleComplete, onDelete, onUpdateTitle, startInEditMode = false, onInitialEditDone }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isInitialNewSubitemEdit, setIsInitialNewSubitemEdit] = useState(startInEditMode);
  const [editedTitle, setEditedTitle] = useState(subitem.title);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Changed from titleInputRef
  const [menuIsVisible, setMenuIsVisible] = useState(false);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height to allow shrinking
      const scrollHeight = textareaRef.current.scrollHeight;
      // Estimate visual heights. Input h-8 is 32px. Two lines around 48-52px.
      const oneLineVisualHeight = 32; 
      const twoLinesVisualHeight = 50; // Adjusted for better visual fit of 2 lines with padding/border

      if (scrollHeight > oneLineVisualHeight) {
        textareaRef.current.style.height = `${Math.min(scrollHeight, twoLinesVisualHeight)}px`;
      } else {
        // Ensure it doesn't go below the initial single line visual height
        textareaRef.current.style.height = `${oneLineVisualHeight}px`;
      }
    }
  }, []);

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      setIsInitialNewSubitemEdit(true);
      setMenuIsVisible(false);
    }
  }, [startInEditMode]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      if (isInitialNewSubitemEdit || editedTitle === "Untitled Item") {
        textareaRef.current.select();
      }
      adjustTextareaHeight(); // Adjust height when editing starts
    }
  }, [isEditing, isInitialNewSubitemEdit, editedTitle, adjustTextareaHeight]);
  
  useEffect(() => {
    // Adjust height when editedTitle changes during editing
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [editedTitle, isEditing, adjustTextareaHeight]);


  const handleStartEdit = () => {
    setEditedTitle(subitem.title);
    setIsEditing(true);
    setMenuIsVisible(false);
  };

  const handleUpdateTitle = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== subitem.title) {
      onUpdateTitle(subitem.id, trimmedTitle);
    } else if (!trimmedTitle) { 
      if (isInitialNewSubitemEdit) { 
        onDelete(subitem.id);
      } else {
        setEditedTitle(subitem.title); 
      }
    }
    setIsEditing(false);
    if (isInitialNewSubitemEdit) {
      setIsInitialNewSubitemEdit(false);
      if (onInitialEditDone) {
        onInitialEditDone(subitem.id);
      }
    }
  };

  const handleCancelEdit = () => {
    if (isInitialNewSubitemEdit && (editedTitle.trim() === "" || editedTitle === "Untitled Item")) {
      onDelete(subitem.id); 
    } else {
      setEditedTitle(subitem.title);
    }
    setIsEditing(false);
    if (isInitialNewSubitemEdit) {
      setIsInitialNewSubitemEdit(false);
      if (onInitialEditDone) {
        onInitialEditDone(subitem.id);
      }
    }
  };


  const handleRowClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
        return;
    }
    setMenuIsVisible(true);
  };

  return (
    <div
      className={cn(
        "flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group"
      )}
      onClick={handleRowClick}
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
          <Textarea
            ref={textareaRef}
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            rows={1} // Start with 1 row, JS will adjust height
            className="w-full resize-none overflow-y-hidden rounded-md border border-input bg-background px-2.5 py-1.5 text-sm leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[32px]"
            onBlur={handleUpdateTitle}
            onKeyDown={(e) => { 
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleUpdateTitle(); 
              }
              if (e.key === 'Escape') {
                handleCancelEdit(); 
              }
              e.stopPropagation(); 
            }}
            onClick={(e) => e.stopPropagation()}
            onInput={adjustTextareaHeight} // Adjust height on every input
          />
        ) : (
          <span
            className={cn("block text-sm line-clamp-2", subitem.completed ? "line-through text-muted-foreground" : "")}
            title={subitem.title}
          >
            {subitem.title}
          </span>
        )}
      </div>

      <div className={cn("flex items-center space-x-1 flex-shrink-0 transition-opacity duration-150", (menuIsVisible && !isEditing) ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleUpdateTitle();}} aria-label="Save subitem title">
              <Save className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleCancelEdit();}} aria-label="Cancel editing subitem title">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
            <DropdownMenu onOpenChange={(open) => { if (!open) setTimeout(() => setMenuIsVisible(false), 150); }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More options for subitem" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
                    onToggleComplete(subitem.id, !subitem.completed);
                  }}
                >
                  {subitem.completed ? <Circle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  {subitem.completed ? "Mark as Incomplete" : "Mark as Complete"}
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

SubitemComponent.displayName = "SubitemComponent";
export default SubitemComponent;

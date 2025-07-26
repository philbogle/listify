
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Save, X, MoreVertical, Edit3, CheckCircle2, Circle } from "lucide-react";
import type { Subitem } from "@/types/list";
import React, { useState, useRef, useEffect, useCallback } from "react";
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
}

const SubitemComponent: FC<SubitemProps> = ({ subitem, onToggleComplete, onDelete, onUpdateTitle, startInEditMode = false, onInitialEditDone }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isInitialNewSubitemEdit, setIsInitialNewSubitemEdit] = useState(startInEditMode);
  const [editedTitle, setEditedTitle] = useState(subitem.title);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [menuIsVisible, setMenuIsVisible] = useState(false);

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height to allow shrinking
      const scrollHeight = textareaRef.current.scrollHeight;
      const oneLineVisualHeight = 32;

      if (scrollHeight > oneLineVisualHeight) {
        textareaRef.current.style.height = `${scrollHeight}px`;
      } else {
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
      if (isInitialNewSubitemEdit || editedTitle === "Untitled Item" || editedTitle === "New Section") {
        textareaRef.current.select();
      }
      adjustTextareaHeight();
    }
  }, [isEditing, isInitialNewSubitemEdit, editedTitle, adjustTextareaHeight]);

  useEffect(() => {
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
      onInitialEditDone?.(subitem.id);
    }
  };

  const handleCancelEdit = () => {
    if (isInitialNewSubitemEdit && (editedTitle.trim() === "" || editedTitle === "Untitled Item" || editedTitle === "New Section")) {
      onDelete(subitem.id);
    } else {
      setEditedTitle(subitem.title);
    }
    setIsEditing(false);
    if (isInitialNewSubitemEdit) {
      setIsInitialNewSubitemEdit(false);
      onInitialEditDone?.(subitem.id);
    }
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if ((e.target as HTMLElement).closest('input[type="checkbox"]')) {
      return;
    }
    handleStartEdit();
  };
  
  if (subitem.isHeader) {
    return (
      <div
        className="flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group cursor-pointer"
        onClick={handleStartEdit}
      >
        <div className="w-5 flex-shrink-0"></div> {/* Spacer to align with checkbox */}
        <div className="flex-grow min-w-0">
          {isEditing ? (
            <Textarea
              ref={textareaRef}
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              rows={1}
              className="w-full resize-none overflow-y-hidden rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-semibold leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[32px]"
              onBlur={handleUpdateTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUpdateTitle(); }
                if (e.key === 'Escape') { handleCancelEdit(); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              onInput={adjustTextareaHeight}
            />
          ) : (
             <span className="block text-sm font-semibold text-card-foreground" title={subitem.title}>
              {subitem.title}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {isEditing ? (
             <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleUpdateTitle();}} aria-label="Save section title">
                <Save className="h-4 w-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleCancelEdit();}} aria-label="Cancel editing section title">
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
             <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => {e.stopPropagation(); onDelete(subitem.id);}} aria-label="Delete section header">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

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
            rows={1}
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
            onInput={adjustTextareaHeight}
          />
        ) : (
          <span
            className={cn("block text-sm", subitem.completed ? "line-through text-muted-foreground" : "")}
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

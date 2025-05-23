
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, X, MoreVertical, Edit3 } from "lucide-react"; // Added Edit3
import type { Subitem } from "@/types/list";
import { useState, useRef, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  const [menuIsVisible, setMenuIsVisible] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditedTitle(subitem.title);
    setIsEditing(true);
    setMenuIsVisible(false); // Hide menu when editing starts
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

  const handleRowClick = () => {
    if (!isEditing) {
      setMenuIsVisible(true);
    }
  };

  // Removed handleTitleClick as editing is now through menu

  return (
    <div
      className="flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group" // Added group for potential future hover effects on menu itself
      onClick={handleRowClick} // Click on row shows menu
    >
      <Checkbox
        id={`subitem-${subitem.id}`}
        checked={subitem.completed}
        onCheckedChange={(checked) => onToggleComplete(subitem.id, !!checked)}
        onClick={(e) => e.stopPropagation()} // Prevent row click
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
            // onClick removed, editing is now through menu
            className={`block text-sm truncate ${subitem.completed ? "line-through text-muted-foreground" : ""}`}
            title={subitem.title}
          >
            {subitem.title}
          </span>
        )}
      </div>

      {/* Controls section: ... menu or Save/Cancel for editing */}
      <div className={`flex items-center space-x-1 flex-shrink-0 transition-opacity duration-150 ${ (menuIsVisible || isEditing) ? 'opacity-100' : 'opacity-0 pointer-events-none' }`}>
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
          // Only show the menu trigger if menuIsVisible is true and not editing
          menuIsVisible && (
            <DropdownMenu 
              onOpenChange={(open) => { 
                // This logic helps hide the inline menu button if the dropdown is closed (e.g., by clicking outside)
                if(!open && menuIsVisible) {
                  setTimeout(() => setMenuIsVisible(false), 50); // Small delay to allow menu item click to process
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More options for subitem" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartEdit(); // This now also sets menuIsVisible to false
                  }}
                >
                  <Edit3 className="mr-2 h-4 w-4" /> {/* Using Edit3 icon */}
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(subitem.id);
                    setMenuIsVisible(false);
                  }}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        )}
      </div>
    </div>
  );
};

export default SubitemComponent;


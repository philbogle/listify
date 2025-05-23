
"use client";

import type { FC } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, X } from "lucide-react";
import type { Subitem } from "@/types/list"; // Renamed import
import { useState } from "react";

interface SubitemProps { // Renamed interface
  subitem: Subitem; // Renamed prop
  onToggleComplete: (subitemId: string, completed: boolean) => void;
  onDelete: (subitemId: string) => void;
  onUpdateTitle: (subitemId: string, newTitle: string) => void;
}

const SubitemComponent: FC<SubitemProps> = ({ subitem, onToggleComplete, onDelete, onUpdateTitle }) => { // Renamed component and prop
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(subitem.title);

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
        id={`subitem-${subitem.id}`} // Changed ID prefix
        checked={subitem.completed}
        onCheckedChange={(checked) => onToggleComplete(subitem.id, !!checked)}
        aria-label={subitem.completed ? "Mark item as incomplete" : "Mark item as complete"} // Changed ARIA label
        className="flex-shrink-0"
      />
      {isEditing ? (
        <Input 
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="flex-grow h-8 text-sm"
          autoFocus
          onBlur={handleUpdateTitle} 
          onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTitle(); if (e.key === 'Escape') handleCancelEdit(); }}
        />
      ) : (
        <span
          onClick={handleStartEdit}
          className={`flex-grow text-sm cursor-pointer truncate ${subitem.completed ? "line-through text-muted-foreground" : ""}`}
          title={subitem.title} 
        >
          {subitem.title}
        </span>
      )}
      
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
          null 
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(subitem.id)} aria-label="Delete subitem">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SubitemComponent; // Renamed export

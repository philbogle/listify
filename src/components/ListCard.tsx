
"use client";

import type { FC } from "react";
import { useState, useEffect, useRef } from "react"; // Added useRef
import type { List, Subitem } from "@/types/list";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Save, X, MoreVertical } from "lucide-react";
import SubitemComponent from "./Subitem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ListCardProps {
  list: List;
  onUpdateList: (listId: string, updates: Partial<List>) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onManageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  startInEditMode?: boolean;
  onInitialEditDone?: (listId: string) => void;
}

const ListCard: FC<ListCardProps> = ({ list, onUpdateList, onDeleteList, onManageSubitems, startInEditMode = false, onInitialEditDone }) => {
  const [newSubitemTitle, setNewSubitemTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const [editedDescription, setEditedDescription] = useState(list.description || "");
  const titleInputRef = useRef<HTMLInputElement>(null); // Ref for title input

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      // No direct onInitialEditDone call here, it's tied to the main editing state.
    }
  }, [startInEditMode]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.select();
      if (startInEditMode && onInitialEditDone) { // Call onInitialEditDone when focused due to startInEditMode
        onInitialEditDone(list.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, startInEditMode]); // Add startInEditMode to deps for onInitialEditDone logic


  const handleToggleComplete = (completed: boolean) => {
    onUpdateList(list.id, { completed });
  };

  const handleAddSubitem = () => {
    if (newSubitemTitle.trim() === "") return;
    const newSubitem: Subitem = {
      id: crypto.randomUUID(),
      title: newSubitemTitle.trim(),
      completed: false,
    };
    onManageSubitems(list.id, [...list.subitems, newSubitem]);
    setNewSubitemTitle("");
  };

  const handleToggleSubitemComplete = (subitemId: string, completed: boolean) => {
    const updatedSubitems = list.subitems.map((si) =>
      si.id === subitemId ? { ...si, completed } : si
    );
    onManageSubitems(list.id, updatedSubitems);
  };

  const handleDeleteSubitem = (subitemId: string) => {
    const updatedSubitems = list.subitems.filter(si => si.id !== subitemId);
    onManageSubitems(list.id, updatedSubitems);
  };

  const handleUpdateSubitemTitle = (subitemId: string, newTitle: string) => {
    const updatedSubitems = list.subitems.map(si =>
      si.id === subitemId ? { ...si, title: newTitle } : si
    );
    onManageSubitems(list.id, updatedSubitems);
  };

  const handleEdit = () => {
    setEditedTitle(list.title);
    setEditedDescription(list.description || "");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (list.title === "Untitled List" && editedTitle === "Untitled List" && (editedDescription === "" || !editedDescription) && startInEditMode) {
        onDeleteList(list.id);
    } else {
        setEditedTitle(list.title);
        setEditedDescription(list.description || "");
    }
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    let titleToSave = editedTitle.trim();
    if (titleToSave === "") {
        if (list.title === "Untitled List" && startInEditMode) { // If it was an auto-created "Untitled List" and is still blank
            onDeleteList(list.id);
            setIsEditing(false);
            return;
        }
        titleToSave = list.title || "Untitled List"; // Fallback to original or "Untitled List"
        setEditedTitle(titleToSave); // Update state to reflect fallback
    }
    await onUpdateList(list.id, {
      title: titleToSave,
      description: editedDescription.trim(),
    });
    setIsEditing(false);
  };


  return (
    <Card className={`mb-4 shadow-lg transition-all duration-300 ${list.completed ? "opacity-70 bg-secondary/30" : "bg-card"}`}>
      <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-1">
        <div className="flex items-center space-x-3 flex-grow min-w-0">
          <Checkbox
            id={`list-${list.id}`}
            checked={list.completed}
            onCheckedChange={(checked) => handleToggleComplete(!!checked)}
            onClick={(e) => e.stopPropagation()}
            className="h-6 w-6 flex-shrink-0"
            aria-label={list.completed ? "Mark list as incomplete" : "Mark list as complete"}
          />
          {isEditing ? (
             <Input
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-xl font-semibold leading-none tracking-tight h-9 flex-grow"
                autoFocus
                onBlur={handleSaveEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
              />
          ) : (
            <CardTitle
              className={`text-xl font-semibold leading-none tracking-tight cursor-pointer truncate ${list.completed ? "line-through" : ""}`}
              onClick={handleEdit}
              title={list.title}
            >
              {list.title}
            </CardTitle>
          )}
        </div>
        <div className="flex items-start space-x-1 flex-shrink-0">
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
                <Button variant="ghost" size="icon" className="h-6 w-6 transform -translate-y-1" aria-label="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDeleteList(list.id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  Delete List
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
              <label htmlFor={`edit-desc-${list.id}`} className="text-sm font-medium text-muted-foreground">Description</label>
              <Textarea
                id={`edit-desc-${list.id}`}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                placeholder="List description"
                className="min-h-[60px]"
              />
            </div>
          </>
        ) : (
          <>
            {(list.description || (list.description === "" && isEditing)) && (
              <div className="flex items-start space-x-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="whitespace-pre-wrap">{list.description || <span className="italic">No description</span>}</p>
              </div>
            )}
          </>
        )}

        {list.subitems.length > 0 && (
          <div className="space-y-1">
            <div className="pl-2 space-y-0.5">
              {list.subitems.map((subitem) => (
                <SubitemComponent
                  key={subitem.id}
                  subitem={subitem}
                  onToggleComplete={handleToggleSubitemComplete}
                  onDelete={handleDeleteSubitem}
                  onUpdateTitle={handleUpdateSubitemTitle}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {!list.completed && (
         <CardFooter className="pt-2 pb-4 border-t">
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="Add an item..."
              value={newSubitemTitle}
              onChange={(e) => setNewSubitemTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubitem()}
              className="h-9"
            />
            <Button onClick={handleAddSubitem} variant="outline" size="sm" aria-label="Add item">
              <Plus className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ListCard;


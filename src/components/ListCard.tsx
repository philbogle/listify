
"use client";

import type { FC } from "react";
import { useState, useEffect, useRef } from "react";
import type { List, Subitem } from "@/types/list";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Plus, Save, X, MoreVertical, Loader2, Sparkles, Eye } from "lucide-react";
import SubitemComponent from "./Subitem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { generateSubitemsForList, type GenerateSubitemsInput } from "@/ai/flows/generateSubitemsFlow";
import { cn } from "@/lib/utils";


interface ListCardProps {
  list: List;
  onUpdateList: (listId: string, updates: Partial<List>) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onManageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  startInEditMode?: boolean;
  onInitialEditDone?: (listId: string) => void;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
  onViewScan?: (imageUrl: string) => void;
}

const ListCard: FC<ListCardProps> = ({ list, onUpdateList, onDeleteList, onManageSubitems, startInEditMode = false, onInitialEditDone, toast, onViewScan }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingItems, setIsGeneratingItems] = useState(false);
  const [subitemToFocusId, setSubitemToFocusId] = useState<string | null>(null);
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);


  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
    }
  }, [startInEditMode]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      requestAnimationFrame(() => { 
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      });
      if (startInEditMode && onInitialEditDone) {
        onInitialEditDone(list.id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, startInEditMode]); 


  const handleToggleComplete = (completed: boolean) => {
    onUpdateList(list.id, { completed });
  };

  const handleAddNewSubitemInEditMode = () => {
    const newSubitem: Subitem = {
      id: crypto.randomUUID(),
      title: "Untitled Item",
      completed: false,
    };
    onManageSubitems(list.id, [...list.subitems, newSubitem]);
    setSubitemToFocusId(newSubitem.id);
  };

  const handleSubitemInitialEditDone = (subitemId: string) => {
    if (subitemId === subitemToFocusId) {
      setSubitemToFocusId(null);
    }
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
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (list.title === "Untitled List" && editedTitle === "Untitled List" && startInEditMode) {
        onDeleteList(list.id);
    } else {
        setEditedTitle(list.title);
    }
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    let titleToSave = editedTitle.trim();
    if (titleToSave === "") {
        if (list.title === "Untitled List" && startInEditMode) {
            onDeleteList(list.id);
            setIsEditing(false);
            return;
        }
        titleToSave = list.title || "Untitled List"; 
        setEditedTitle(titleToSave);
    }
    await onUpdateList(list.id, {
      title: titleToSave,
    });
    setIsEditing(false);
  };

  const handleAutogenerateItems = async () => {
    setIsGeneratingItems(true);
    try {
      const input: GenerateSubitemsInput = {
        listTitle: list.title,
        existingSubitemTitles: list.subitems.map(si => si.title),
      };
      const result = await generateSubitemsForList(input);
      
      if (result && result.newSubitemTitles && result.newSubitemTitles.length > 0) {
        const newSubitems: Subitem[] = result.newSubitemTitles.map(title => ({
          id: crypto.randomUUID(),
          title: title.trim(),
          completed: false,
        }));
        const newIds = newSubitems.map(item => item.id);
        setHighlightedItemIds(newIds);
        await onManageSubitems(list.id, [...list.subitems, ...newSubitems]);
        // toast({ title: "Items Generated", description: `${newSubitems.length} new items added to "${list.title}".` }); // Toast removed
        setTimeout(() => {
          setHighlightedItemIds([]);
        }, 2000); // Duration for the highlight animation + buffer
      } else if (result && result.newSubitemTitles && result.newSubitemTitles.length === 0){
        toast({
            title: "No New Items",
            description: "AI couldn't find any new items to suggest for this list right now.",
            variant: "default",
        });
      } else {
        toast({
            title: "Autogeneration Failed",
            description: "Could not generate new items. Please try again.",
            variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error autogenerating items:", error);
      let errorMsg = "An error occurred while trying to generate items.";
      if (error.message && error.message.includes("GEMINI_API_KEY")) {
        errorMsg = "AI processing failed. Check API key configuration.";
      } else if (error.message && error.message.includes("Please pass in the API key")) {
        errorMsg = "AI processing failed. API key might be missing or invalid in your production environment.";
      } else if (error.message) {
        errorMsg = `AI processing error: ${error.message.substring(0,100)}${error.message.length > 100 ? '...' : ''}`;
      }
      toast({
        title: "AI Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingItems(false);
    }
  };


  return (
    <Card 
      className={cn(
        "mb-4 shadow-lg origin-center transition-all duration-300 ease-in-out transform",
        list.completed ? "opacity-60 bg-secondary/30 scale-[0.97] hover:opacity-75" : "bg-card scale-100 opacity-100",
        startInEditMode && "animate-list-card-enter" 
      )}
    >
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
                autoFocus={startInEditMode} 
                onBlur={handleSaveEdit}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
              />
          ) : (
            <CardTitle
              className={`text-xl font-semibold leading-none tracking-tight cursor-pointer truncate transition-colors duration-300 ${list.completed ? "line-through text-muted-foreground/80" : "text-card-foreground"}`}
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
                {list.scanImageUrl && (
                  <DropdownMenuItem onClick={() => onViewScan?.(list.scanImageUrl!)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Scan
                  </DropdownMenuItem>
                )}
                {(list.scanImageUrl) && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  onClick={handleAutogenerateItems}
                  disabled={isGeneratingItems || list.completed}
                >
                  {isGeneratingItems ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Autogenerate Items
                </DropdownMenuItem>
                <DropdownMenuSeparator />
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
                  startInEditMode={subitem.id === subitemToFocusId}
                  onInitialEditDone={handleSubitemInitialEditDone}
                  isHighlighted={highlightedItemIds.includes(subitem.id)}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {!list.completed && (
         <CardFooter className="pt-2 pb-4 border-t">
          <div className="flex w-full space-x-2">
            <Button onClick={handleAddNewSubitemInEditMode} variant="outline" size="sm" className="flex-1" aria-label="Add new item">
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
            <Button 
              onClick={handleAutogenerateItems} 
              variant="outline" 
              size="sm" 
              className="flex-1" 
              aria-label="Autogenerate items"
              disabled={isGeneratingItems || list.completed}
            >
              {isGeneratingItems ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Autogenerate
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

export default ListCard;

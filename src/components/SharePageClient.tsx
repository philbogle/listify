
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { List, Subitem } from "@/types/list";
import {
  listenToListByShareId,
  updateListInFirebase,
  updateSubitemsInFirebase,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, AlertTriangle, Plus, Save, X, Trash2, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const SharedListSubitem: React.FC<{
  subitem: Subitem;
  onToggleComplete: (subitemId: string, completed: boolean) => void;
  onDelete: (subitemId: string) => void;
  onUpdateTitle: (subitemId: string, newTitle: string) => void;
  isListCompleted: boolean;
}> = ({ subitem, onToggleComplete, onDelete, onUpdateTitle, isListCompleted }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(subitem.title);
  const textareaRef = useRef<HTMLTextAreaElement>(null); 

  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
    setEditedTitle(subitem.title);
  }, [subitem.title]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
      adjustTextareaHeight();
    }
  }, [isEditing, adjustTextareaHeight]);

  useEffect(() => {
    if (isEditing) {
      adjustTextareaHeight();
    }
  }, [editedTitle, isEditing, adjustTextareaHeight]);


  const handleSave = () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== subitem.title) {
      onUpdateTitle(subitem.id, trimmedTitle);
    } else if (!trimmedTitle) {
      setEditedTitle(subitem.title); 
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(subitem.title);
    setIsEditing(false);
  };

  if (isListCompleted) { 
    return (
      <div className="flex items-center space-x-3 py-2 px-1 rounded-md group">
        <Checkbox
          id={`subitem-${subitem.id}-shared`}
          checked={subitem.completed}
          disabled={true}
          className="flex-shrink-0 h-5 w-5"
        />
        <span className={cn("block text-sm", subitem.completed ? "line-through text-muted-foreground" : "")} title={subitem.title}>
          {subitem.title}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 py-2 px-1 rounded-md hover:bg-secondary/50 transition-colors group">
      <Checkbox
        id={`subitem-${subitem.id}-shared`}
        checked={subitem.completed}
        onCheckedChange={(checked) => onToggleComplete(subitem.id, !!checked)}
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
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSave();
              }
              if (e.key === 'Escape') handleCancel();
            }}
            onInput={adjustTextareaHeight}
          />
        ) : (
          <span
            onClick={() => setIsEditing(true)}
            className={cn("block text-sm cursor-pointer", subitem.completed ? "line-through text-muted-foreground" : "")}
            title={subitem.title}
          >
            {subitem.title}
          </span>
        )}
      </div>
      <div className="flex items-center space-x-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave} aria-label="Save subitem title">
              <Save className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel} aria-label="Cancel editing subitem title">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(subitem.id)} aria-label="Delete subitem">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
SharedListSubitem.displayName = "SharedListSubitem";


export default function SharePageClient() {
  const params = useParams();
  const router = useRouter();
  const shareId = params.shareId as string;
  const { toast } = useToast();

  const [list, setList] = useState<List | null | undefined>(undefined); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedListTitle, setEditedListTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [newSubitemTitle, setNewSubitemTitle] = useState("");

  useEffect(() => {
    if (!shareId) {
      setError("Invalid share link.");
      setIsLoading(false);
      setList(null);
      return;
    }

    if (!isFirebaseConfigured()) {
      setError("App not configured to display shared lists.");
      setIsLoading(false);
      setList(null);
      return;
    }
    
    setIsLoading(true);
    const unsubscribe = listenToListByShareId(
      shareId,
      (updatedList) => {
        setList(updatedList);
        if (updatedList) {
          setEditedListTitle(updatedList.title);
        }
        setIsLoading(false);
        setError(null);
      },
      (err: any) => { 
        console.error("Error listening to shared list:", err);
        let displayError = "Could not load the shared list. It might have been deleted or the link is incorrect.";
        if (err.message) {
          if (err.message.toLowerCase().includes("permission-denied") || err.message.toLowerCase().includes("insufficient permissions")) {
            displayError = "Access denied. This list may not be shared publicly or there's a configuration issue. Please check Firebase security rules.";
          }
        }
        setError(displayError);
        setList(null);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [shareId]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleSaveListTitle = async () => {
    if (!list) return;
    const trimmedTitle = editedListTitle.trim();
    if (trimmedTitle && trimmedTitle !== list.title) {
      try {
        await updateListInFirebase(list.id, { title: trimmedTitle });
      } catch (e) {
        toast({ title: "Error", description: "Could not update list title.", variant: "destructive" });
        setEditedListTitle(list.title); 
      }
    } else if (!trimmedTitle) {
      setEditedListTitle(list.title); 
    }
    setIsEditingTitle(false);
  };

  const handleAddSubitem = async () => {
    if (!list || !newSubitemTitle.trim() || list.completed) return;
    const newSub: Subitem = {
      id: crypto.randomUUID(),
      title: newSubitemTitle.trim(),
      completed: false,
    };
    try {
      await updateSubitemsInFirebase(list.id, [...list.subitems, newSub]);
      setNewSubitemTitle("");
    } catch (e) {
      toast({ title: "Error", description: "Could not add item.", variant: "destructive" });
    }
  };

  const handleToggleSubitemComplete = async (subitemId: string, completed: boolean) => {
    if (!list || list.completed) return;
    const updatedSubitems = list.subitems.map(si =>
      si.id === subitemId ? { ...si, completed } : si
    );
    try {
      await updateSubitemsInFirebase(list.id, updatedSubitems);
    } catch (e) {
      toast({ title: "Error", description: "Could not update item status.", variant: "destructive" });
    }
  };

  const handleUpdateSubitemTitle = async (subitemId: string, newTitle: string) => {
    if (!list || list.completed) return;
    const updatedSubitems = list.subitems.map(si =>
      si.id === subitemId ? { ...si, title: newTitle } : si
    );
    try {
      await updateSubitemsInFirebase(list.id, updatedSubitems);
    } catch (e) {
      toast({ title: "Error", description: "Could not update item title.", variant: "destructive" });
    }
  };

  const handleDeleteSubitem = async (subitemId: string) => {
    if (!list || list.completed) return;
    const updatedSubitems = list.subitems.filter(si => si.id !== subitemId);
    try {
      await updateSubitemsInFirebase(list.id, updatedSubitems);
    } catch (e) {
      toast({ title: "Error", description: "Could not delete item.", variant: "destructive" });
    }
  };

  const handleToggleListComplete = async () => {
    if (!list) return;
    try {
      await updateListInFirebase(list.id, { completed: !list.completed });
    } catch (e) {
      toast({ title: "Error", description: "Could not update list completion status.", variant: "destructive" });
    }
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading shared list...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
                <CardTitle className="text-center text-destructive">Error Loading List</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive" className="text-center">
                    <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
                <Button onClick={() => router.push('/')} className="w-full mt-6">
                    <Home className="mr-2 h-4 w-4" /> Go to Homepage
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (!list) {
    return (
       <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
                <CardTitle className="text-center">List Not Found</CardTitle>
            </CardHeader>
            <CardContent>
                <Alert variant="default" className="text-center"> 
                     <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                    <AlertDescription>The shared list could not be found. It may have been unshared or deleted, or the link is incorrect.</AlertDescription>
                </Alert>
                 <Button onClick={() => router.push('/')} className="w-full mt-6">
                    <Home className="mr-2 h-4 w-4" /> Go to Homepage
                </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 sm:p-8 bg-gradient-to-br from-background to-muted/30">
        <div className="absolute top-4 right-4">
            <Button variant="outline" size="sm" asChild>
                <Link href="/">
                    <Home className="mr-2 h-4 w-4" /> Back to My Lists
                </Link>
            </Button>
        </div>
      <Card className={cn("w-full max-w-xl shadow-xl mt-12", list.completed ? "opacity-70 bg-secondary/30" : "bg-card")}>
        <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-3">
          <div className="flex items-center space-x-3 flex-grow min-w-0">
            {!list.completed && (
              <Checkbox
                id={`list-${list.id}-shared-complete`}
                checked={list.completed}
                onCheckedChange={handleToggleListComplete}
                className="h-6 w-6 flex-shrink-0"
                aria-label={list.completed ? "Mark list as active" : "Mark list as complete"}
              />
            )}
            {isEditingTitle && !list.completed ? (
              <Input
                ref={titleInputRef}
                value={editedListTitle}
                onChange={(e) => setEditedListTitle(e.target.value)}
                className="text-xl font-semibold leading-none tracking-tight h-9 flex-grow"
                onBlur={handleSaveListTitle}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveListTitle(); if (e.key === 'Escape') {setIsEditingTitle(false); setEditedListTitle(list.title)}}}
              />
            ) : (
              <CardTitle
                className={cn(
                  "text-xl font-semibold leading-none tracking-tight", 
                  list.completed ? "line-through" : "cursor-pointer hover:text-primary"
                )}
                onClick={() => !list.completed && setIsEditingTitle(true)}
                title={list.title}
              >
                {list.title}
              </CardTitle>
            )}
          </div>
           {isEditingTitle && !list.completed && (
             <div className="flex items-center space-x-1 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={handleSaveListTitle} className="h-8 w-8" aria-label="Save list title">
                  <Save className="h-5 w-5 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => {setIsEditingTitle(false); setEditedListTitle(list.title)}} className="h-8 w-8" aria-label="Cancel editing list title">
                  <X className="h-5 w-5" />
                </Button>
            </div>
           )}
        </CardHeader>

        <CardContent className="pb-4 space-y-4">
          {list.subitems.length > 0 ? (
            <div className="space-y-1">
              <div className="pl-2 space-y-0.5">
                {list.subitems.map((subitem) => (
                  <SharedListSubitem
                    key={subitem.id}
                    subitem={subitem}
                    onToggleComplete={handleToggleSubitemComplete}
                    onDelete={handleDeleteSubitem}
                    onUpdateTitle={handleUpdateSubitemTitle}
                    isListCompleted={list.completed}
                  />
                ))}
              </div>
            </div>
          ) : (
            !list.completed && <p className="text-sm text-muted-foreground px-2">No items in this list yet. Add one below!</p>
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
                disabled={list.completed}
              />
              <Button onClick={handleAddSubitem} variant="outline" size="sm" aria-label="Add item" disabled={list.completed}>
                <Plus className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
       <footer className="mt-12 text-center text-xs text-muted-foreground">
        <p>You are viewing a publicly shared list. Changes are saved automatically.</p>
      </footer>
    </div>
  );
}

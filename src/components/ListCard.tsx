
"use client";

import type { FC } from "react";
import React, { useState, useEffect, useRef } from "react";
import type { List, Subitem } from "@/types/list";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Plus, Save, X, MoreVertical, Loader2, Sparkles, Trash2, CheckCircle2, Circle, ClipboardCopy, ScanLine, Share2, Link as LinkIcon, Copy as CopyIcon, Link2Off, ListOrdered, Heading2 } from "lucide-react";
import SubitemComponent from "./Subitem";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { generateSubitemsForList, type GenerateSubitemsInput } from "@/ai/flows/generateSubitemsFlow";
import { cn } from "@/lib/utils";
import { TransitionGroup, CSSTransition } from "react-transition-group";


interface ListCardProps {
  list: List;
  onUpdateList: (listId: string, updates: Partial<List>) => Promise<void>;
  onDeleteListRequested: (listId: string) => void;
  onManageSubitems: (listId: string, newSubitems: Subitem[]) => Promise<void>;
  onAutosortItemsRequested: (listId: string) => Promise<void>;
  startInEditMode?: boolean;
  onInitialEditDone?: (listId: string) => void;
  toast: (options: { title: string; description?: string; variant?: "default" | "destructive"; duration?: number }) => void;
  onDeleteCompletedItemsRequested: (listId: string) => void;
  onScanMoreItemsRequested: (listId: string, listTitle: string) => void;
  shareList: (listId: string) => Promise<string | null>;
  unshareList: (listId: string) => Promise<void>;
  isUserAuthenticated: boolean;
  currentUserId: string | null;
}

const ListCard: FC<ListCardProps> = ({
  list,
  onUpdateList,
  onDeleteListRequested,
  onManageSubitems,
  onAutosortItemsRequested,
  startInEditMode = false,
  onInitialEditDone,
  toast,
  onDeleteCompletedItemsRequested,
  onScanMoreItemsRequested,
  shareList,
  unshareList,
  isUserAuthenticated,
}) => {
  const [isEditing, setIsEditing] = useState(false); 
  const [isInitialNewListEdit, setIsInitialNewListEdit] = useState(startInEditMode);
  const [editedTitle, setEditedTitle] = useState(list.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingItems, setIsGeneratingItems] = useState(false);
  const [isAutosorting, setIsAutosorting] = useState(false);
  const [subitemToFocusId, setSubitemToFocusId] = useState<string | null>(null);

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [shareLinkValue, setShareLinkValue] = useState("");

  const hasCompletedSubitems = list.subitems.some(si => si.completed);

  useEffect(() => {
    if (list.shareId && typeof window !== 'undefined') {
      setShareLinkValue(`${window.location.origin}/share/${list.shareId}`);
    } else {
      setShareLinkValue("");
    }
  }, [list.shareId]);

  useEffect(() => {
    if (startInEditMode) {
      setIsEditing(true);
      setIsInitialNewListEdit(true);
    }
  }, [startInEditMode]);

  useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);


  const handleToggleListComplete = (completed: boolean) => {
    onUpdateList(list.id, { completed });
  };
  
  const handleAddNewSubitem = (isHeader: boolean) => {
    const newSubitem: Subitem = {
      id: crypto.randomUUID(),
      title: isHeader ? "New Section" : "Untitled Item",
      completed: false,
      isHeader,
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
  
  const handleSaveEdit = async () => {
    const titleToSave = editedTitle.trim() || "Untitled List"; // Ensure it's not empty
  
    await onUpdateList(list.id, { title: titleToSave });
    setEditedTitle(titleToSave); 
    setIsEditing(false);
    if (isInitialNewListEdit) {
      setIsInitialNewListEdit(false);
      if (onInitialEditDone) {
        onInitialEditDone(list.id); 
      }
    }
  };

  const handleCancelEdit = () => {
    if (isInitialNewListEdit && (list.title === "Untitled List" || editedTitle.trim() === "Untitled List" || editedTitle.trim() === "") && list.subitems.length === 0) {
      onDeleteListRequested(list.id);
    } else {
      setEditedTitle(list.title);
    }
    setIsEditing(false);
    if (isInitialNewListEdit) {
      setIsInitialNewListEdit(false);
      if (onInitialEditDone) {
        onInitialEditDone(list.id);
      }
    }
  };


  const handleAutogenerateItems = async () => {
    if (!list.title.trim() && list.subitems.length === 0) {
      toast({
        title: "Cannot Autogenerate",
        description: "Please provide a list title or add some items first to give the AI context.",
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingItems(true);
    try {
      const input: GenerateSubitemsInput = {
        promptForGeneration: list.title || "Related items",
        existingSubitemTitles: list.subitems.map(si => si.title),
      };
      const result = await generateSubitemsForList(input);

      if (result && result.newSubitemTitles && result.newSubitemTitles.length > 0) {
        const newSubitems: Subitem[] = result.newSubitemTitles.map(title => ({
          id: crypto.randomUUID(),
          title: title.trim(),
          completed: false,
        }));
        await onManageSubitems(list.id, [...list.subitems, ...newSubitems]);
        toast({
          title: "Items Autogenerated!",
          description: `${newSubitems.length} new item(s) added to "${list.title || 'your list'}".`,
        });
      } else if (result && result.newSubitemTitles && result.newSubitemTitles.length === 0){
        toast({
            title: "No New Items",
            description: "The AI couldn't think of any new items for this list right now.",
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

  const handleAutosortItems = async () => {
    if (list.subitems.length < 2) {
      toast({ title: "Not enough items", description: "Need at least two items to autosort.", variant: "default" });
      return;
    }
    setIsAutosorting(true);
    try {
      await onAutosortItemsRequested(list.id);
      // Toast for success/failure is handled in useLists hook
    } catch (error) {
      // Error toast is handled in useLists hook
      console.error("Error in ListCard calling onAutosortItemsRequested:", error);
    } finally {
      setIsAutosorting(false);
    }
  };

  const handleCopyListContent = async () => {
    let textToCopy = `${list.title}\n`;
    textToCopy += list.subitems.map(si => `${si.completed ? '+' : '-'} ${si.title}`).join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast({
        title: "List Copied!",
        description: `"${list.title}" content has been copied to your clipboard.`,
        duration: 3000,
      });
    } catch (err) {
      console.error('Failed to copy list content: ', err);
      toast({
        title: "Copy Failed",
        description: "Could not copy list content to your clipboard.",
        variant: "destructive",
      });
    }
  };

  const handleOpenShareDialog = () => {
    if (!isUserAuthenticated) {
      toast({ title: "Sign In Required", description: "Please sign in to share lists.", variant: "destructive" });
      return;
    }
    if (list.shareId && typeof window !== 'undefined') {
      setShareLinkValue(`${window.location.origin}/share/${list.shareId}`);
    }
    setIsShareDialogOpen(true);
  };

  const handleGenerateShareLink = async () => {
    if (!isUserAuthenticated) {
      toast({ title: "Sign In Required", variant: "destructive" });
      setIsShareDialogOpen(false);
      return;
    }
    setIsSharingLoading(true);
    try {
      const newShareId = await shareList(list.id);
      if (newShareId && typeof window !== 'undefined') {
        setShareLinkValue(`${window.location.origin}/share/${newShareId}`);
      } else if (!newShareId) {
         toast({ title: "Sharing Failed", description: "Could not generate a share link.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Sharing Error", description: "An error occurred while trying to share the list.", variant: "destructive" });
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!shareLinkValue) return;
    try {
      await navigator.clipboard.writeText(shareLinkValue);
      toast({
        title: "Link Copied!",
        description: "The share link has been copied to your clipboard.",
        duration: 3000,
      });
    } catch (err) {
      console.error('Failed to copy share link: ', err);
      toast({
        title: "Copy Failed",
        description: "Could not copy the share link.",
        variant: "destructive",
      });
    }
  };

  const handleStopSharing = async () => {
     if (!isUserAuthenticated) {
      toast({ title: "Sign In Required", variant: "destructive" });
      setIsShareDialogOpen(false);
      return;
    }
    setIsSharingLoading(true);
    try {
      await unshareList(list.id);
      setShareLinkValue("");
    } catch (error) {
      toast({ title: "Unsharing Error", description: "An error occurred while trying to stop sharing.", variant: "destructive" });
    } finally {
      setIsSharingLoading(false);
    }
  };


  return (
    <>
      <Card
        className={cn(
          "mb-4 shadow-lg origin-center",
          list.completed
            ? "opacity-60 bg-secondary/30 scale-[0.97] hover:opacity-75"
            : "bg-card scale-100 opacity-100",
          "transition-all duration-300 ease-in-out" 
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-x-4 pb-1">
          <div className="flex items-center space-x-3 flex-grow min-w-0">
            <Checkbox
              id={`list-${list.id}`}
              checked={list.completed}
              onCheckedChange={(checked) => handleToggleListComplete(!!checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-6 flex-shrink-0"
              aria-label={list.completed ? "Mark list as active" : "Mark list as complete"}
              disabled={isAutosorting}
            />
            {isEditing ? (
              <Input
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-semibold leading-none tracking-tight h-9 flex-grow"
                  onBlur={handleSaveEdit} 
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') handleCancelEdit(); }}
                  disabled={isAutosorting}
                />
            ) : (
              <div className="flex items-center space-x-2 flex-grow min-w-0">
                <CardTitle
                  className={cn(
                    "text-xl font-semibold leading-none tracking-tight cursor-pointer truncate transition-colors duration-300",
                    list.completed ? "line-through text-muted-foreground/80" : "text-card-foreground",
                    isAutosorting ? "text-muted-foreground" : ""
                  )}
                  onClick={!isAutosorting ? handleEdit : undefined}
                  title={list.title}
                >
                  {list.title}
                </CardTitle>
                {isAutosorting && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              </div>
            )}
          </div>
          <div className="flex items-start space-x-1 flex-shrink-0 transform -translate-y-1">
            {isEditing ? (
              <>
                <Button variant="ghost" size="icon" onClick={handleSaveEdit} className="h-8 w-8" aria-label="Save changes" disabled={isAutosorting}>
                  <Save className="h-5 w-5 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-8 w-8" aria-label="Cancel editing" disabled={isAutosorting}>
                  <X className="h-5 w-5" />
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="More options" disabled={isAutosorting}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleToggleListComplete(!list.completed)} disabled={isAutosorting}>
                    {list.completed ? <Circle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    {list.completed ? "Mark as Active" : "Mark as Complete"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleAddNewSubitem(false)} disabled={list.completed || isAutosorting}>
                      <Plus className="mr-2 h-4 w-4" /> Add Item
                  </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => handleAddNewSubitem(true)} disabled={list.completed || isAutosorting}>
                      <Heading2 className="mr-2 h-4 w-4" /> Add Section Header
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCopyListContent} disabled={isAutosorting}>
                    <ClipboardCopy className="mr-2 h-4 w-4" />
                    Copy List
                  </DropdownMenuItem>
                   <DropdownMenuItem
                    onClick={() => onScanMoreItemsRequested(list.id, list.title)}
                    disabled={list.completed || isAutosorting}
                  >
                    <ScanLine className="mr-2 h-4 w-4" />
                    Scan More Items
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleOpenShareDialog} disabled={list.completed || !isUserAuthenticated || isAutosorting}>
                    <Share2 className="mr-2 h-4 w-4" />
                    {list.shareId ? "Manage Sharing" : "Share List"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleAutogenerateItems}
                    disabled={isGeneratingItems || list.completed || isAutosorting}
                  >
                    {isGeneratingItems ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Autogenerate Items
                  </DropdownMenuItem>
                   <DropdownMenuItem
                    onClick={handleAutosortItems}
                    disabled={isAutosorting || list.completed || list.subitems.length < 2}
                  >
                    {isAutosorting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ListOrdered className="mr-2 h-4 w-4" />
                    )}
                    Autosort & Group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteCompletedItemsRequested(list.id)}
                    disabled={!hasCompletedSubitems || list.completed || isAutosorting}
                    className={(!hasCompletedSubitems || list.completed) ? "text-muted-foreground" : ""}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Completed Items
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDeleteListRequested(list.id)}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    disabled={isAutosorting}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete List
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-4 space-y-4">
          <TransitionGroup component="div" className="space-y-1">
            {list.subitems.map((subitem) => {
              const nodeRef = React.createRef<HTMLDivElement>();
              return (
                <CSSTransition
                  key={subitem.id}
                  nodeRef={nodeRef}
                  timeout={{ enter: 0, exit: 200 }} 
                  classNames="subitem"
                >
                  <div ref={nodeRef} className="pl-8">
                    <SubitemComponent
                      subitem={subitem}
                      onToggleComplete={handleToggleSubitemComplete}
                      onDelete={handleDeleteSubitem}
                      onUpdateTitle={handleUpdateSubitemTitle}
                      startInEditMode={subitem.id === subitemToFocusId}
                      onInitialEditDone={handleSubitemInitialEditDone}
                    />
                  </div>
                </CSSTransition>
              );
            })}
          </TransitionGroup>
        </CardContent>

        {!list.completed && (
          <CardFooter className="pt-2 pb-4 border-t">
            <div className="flex w-full space-x-2">
              <Button onClick={() => handleAddNewSubitem(false)} variant="outline" size="sm" className="flex-1" aria-label="Add new item" disabled={isAutosorting}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
              <Button
                onClick={handleAutogenerateItems}
                variant="outline"
                size="sm"
                className="flex-1"
                aria-label="Autogenerate items"
                disabled={isGeneratingItems || list.completed || isAutosorting}
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

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{list.shareId ? "Manage Sharing" : "Share List"}</DialogTitle>
            <DialogDescription>
              {list.shareId
                ? "This list is currently shared. Anyone with the link can view and edit it."
                : "Generate a public link to share this list. Anyone with the link can view and edit it. This feature requires you to be signed in."}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {list.shareId ? (
              <>
                <div className="flex items-center space-x-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    readOnly
                    value={shareLinkValue}
                    className="flex-grow"
                    aria-label="Shareable link"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyShareLink} aria-label="Copy link">
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleStopSharing}
                  disabled={isSharingLoading || !isUserAuthenticated}
                  className="w-full"
                >
                  {isSharingLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2Off className="mr-2 h-4 w-4" />
                  )}
                  Stop Sharing
                </Button>
              </>
            ) : (
              <Button
                onClick={handleGenerateShareLink}
                disabled={isSharingLoading || !isUserAuthenticated}
                className="w-full"
              >
                {isSharingLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="mr-2 h-4 w-4" />
                )}
                Generate Share Link
              </Button>
            )}
          </div>
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
export default ListCard;

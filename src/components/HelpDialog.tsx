
"use client";

import type { FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ListPlus, PlusSquare, Camera, UploadCloud, Sparkles, Settings2, Edit3, CheckSquare, Trash2, Archive, UserCircle2, Smartphone, Code, Cog, Mail, Info, Share2, ZoomIn } from "lucide-react";

interface HelpDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const HelpDialog: FC<HelpDialogProps> = ({ isOpen, onOpenChange }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Listify Help</DialogTitle>
          <DialogDescription className="text-left">
            Listify helps you create, manage, and share lists by scanning images, dictating or pasting text, and autogenerating items with AI. 
            Sign in with Google to save, sync, and share your lists; core AI features are available without sign-in.
            <br />
            <Info size={14} className="inline-block mr-1 relative -top-px" />
            <span className="font-semibold">Important:</span> Listify is experimental and may be taken down at any time. Please don&apos;t use it for sensitive or important data.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-5 text-sm max-h-[60vh] overflow-y-auto pr-2">
          
          <div className="flex items-start">
            <ListPlus size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Creating Lists Manually</h4>
              <p>Click the &quot;Add&quot; button and select &quot;Enter manually&quot; to create a new list. You can name your list and add items directly.</p>
            </div>
          </div>

          <div className="flex items-start">
            <Camera size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Scanning Lists & Objects</h4>
              <p>Select &quot;Scan&quot; from the &quot;Add&quot; menu. Use your camera to take a picture of handwriting, printed text, or physical items. You can crop the image before AI processing. The AI will then create a list title and items based on the image content.</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <UploadCloud size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Dictate or Paste Text</h4>
              <p>Choose &quot;Dictate or Paste&quot; from the &quot;Add&quot; menu. Paste text or use your mobile device&apos;s keyboard dictation feature into the dialog. The AI will convert this text into a structured list.</p>
            </div>
          </div>

          <div className="flex items-start">
            <Sparkles size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Autogenerating Items</h4>
              <p>Use the &quot;Autogenerate&quot; button on a list card or the &quot;Autogenerate Items&quot; menu option. The AI suggests new items based on the list&apos;s title and existing content (up to 50 items) directly, without an additional dialog.</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <PlusSquare size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Adding Items to Lists</h4>
              <p>Once a list is created, click &quot;Add Item&quot; at the bottom of its card to add a new item to that specific list.</p>
            </div>
          </div>

          <div className="flex items-start">
            <Settings2 size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Managing Lists & Items</h4>
              <ul className="list-disc pl-5 space-y-1.5 mt-1">
                <li><Edit3 size={14} className="inline-block mr-1.5 relative -top-px text-muted-foreground" /><strong>Edit Titles:</strong> Click a list or item title to edit.</li>
                <li><CheckSquare size={14} className="inline-block mr-1.5 relative -top-px text-muted-foreground" /><strong>Complete:</strong> Use checkboxes or the menu option to mark lists/items complete.</li>
                <li><Trash2 size={14} className="inline-block mr-1.5 relative -top-px text-muted-foreground" /><strong>Delete:</strong> Use the three-dot menu for deletion. Options include deleting the entire list or just its completed items.</li>
                <li><Share2 size={14} className="inline-block mr-1.5 relative -top-px text-muted-foreground" /><strong>Share:</strong> If signed in, you can share lists publicly. Anyone with the link can view and edit.</li>
                <li><ZoomIn size={14} className="inline-block mr-1.5 relative -top-px text-muted-foreground" /><strong>View & Zoom Scans:</strong> List owners can view and zoom into their scanned images from the list menu.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-start">
            <Archive size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Completed Lists Section</h4>
              <p>Completed lists are automatically moved to a collapsible &quot;Completed&quot; section at the bottom of your lists page. Expand this to view or manage them.</p>
            </div>
          </div>

          <div className="flex items-start">
            <UserCircle2 size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">User Accounts & App Access</h4>
              <p>Sign in with Google (via the hamburger menu) to save your lists to the cloud, sync them across devices, and enable list sharing. Core AI features like scanning, dictating/pasting, and autogenerating items are available without signing in; data is stored locally in your browser in that case.</p>
              <p className="mt-1.5 flex items-start"><Smartphone size={16} className="inline-block mr-1.5 mt-0.5 flex-shrink-0 text-muted-foreground" />On supported browsers (like Chrome on Android or Safari on iOS), you can often use the browser&apos;s menu to &quot;Add to Home Screen&quot; or &quot;Install app&quot;. This adds a Listify icon for quick launching.</p>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full pt-2">
            <AccordionItem value="technical-details">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">
                <Cog size={16} className="mr-2.5 text-primary flex-shrink-0" />
                Technical Details
              </AccordionTrigger>
              <AccordionContent className="text-xs space-y-2.5">
                <p>
                  Listify is a full-stack web application built with modern technologies.
                </p>
                <ul className="list-disc pl-5 space-y-1.5 mt-1">
                  <li><strong>Frontend:</strong> Next.js (React framework) with TypeScript, styled with Tailwind CSS and ShadCN UI components.</li>
                  <li><strong>Backend & AI:</strong> AI features (image recognition, text interpretation, item generation) are powered by Google&apos;s Gemini models via Genkit.</li>
                  <li><strong>Data Storage:</strong> List data, user authentication (Firebase Authentication), and scanned images (Firebase Storage) are handled by Firebase Firestore.</li>
                  <li><strong>Development:</strong> This application was primarily developed with AI assistance from Firebase Studio&apos;s App Prototyper.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="flex items-start pt-2">
            <Mail size={18} className="mr-2.5 mt-0.5 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-semibold mb-0.5">Questions or Feedback?</h4>
              <p>If you have any questions or feedback, please feel free to reach out: <a href="mailto:philbogle@gmail.com" className="text-primary underline hover:text-primary/80">philbogle@gmail.com</a></p>
            </div>
          </div>

        </div>
        <DialogFooter className="mt-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;

    
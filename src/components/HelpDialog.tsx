
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

interface HelpDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const HelpDialog: FC<HelpDialogProps> = ({ isOpen, onOpenChange }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md md:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scandalist Help</DialogTitle>
          <DialogDescription>
            Scandalist lets you scan, organize, and complete lists. It is experimental and may be taken down at any time, so please don&apos;t use it for sensitive or important data.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3 text-sm max-h-[60vh] overflow-y-auto pr-2">
          <div>
            <h4 className="font-semibold mb-0.5">Creating Lists</h4>
            <p>Click the &quot;Add&quot; button (or select from the menu) to create a new list. You can name your list immediately.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5">Adding Items</h4>
            <p>Once a list is created, click &quot;Add Item&quot; at the bottom of its card to add a new item.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5">Scanning Lists/Items</h4>
            <p>Click &quot;Scan&quot; (or select from the menu). Use your camera to take a picture of handwriting, printed text, or physical items. You can crop the image before conversion. The AI will create a list. Scanned images can be viewed via the list&apos;s menu (&quot;View Scan&quot; option).</p>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5">Autogenerating Items</h4>
            <p>Use the &quot;Autogenerate&quot; button on a list card or the &quot;Autogenerate Items&quot; menu option. The AI suggests new items based on the list&apos;s title and existing content.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5">Managing Lists & Items</h4>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li><strong>Edit Titles:</strong> Click a list or item title to edit.</li>
              <li><strong>Complete:</strong> Use checkboxes or the menu option to mark lists/items complete.</li>
              <li><strong>Delete:</strong> Use the three-dot menu for deletion. Options include deleting the entire list or just its completed items.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5">Completed Lists</h4>
            <p>Completed lists are moved to a collapsible &quot;Completed&quot; section. Expand this to view them.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5">User Accounts</h4>
            <p>Sign in with Google to save and sync your lists. Use the top-right menu for account actions like signing out or accessing this help screen.</p>
          </div>

          <Accordion type="single" collapsible className="w-full pt-2">
            <AccordionItem value="technical-details">
              <AccordionTrigger className="text-sm font-semibold hover:no-underline">Technical Details</AccordionTrigger>
              <AccordionContent className="text-xs space-y-2">
                <p>
                  Scandalist is a full-stack web application built with modern technologies.
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Frontend:</strong> Next.js (React framework) for the user interface, styled with Tailwind CSS and ShadCN UI components.</li>
                  <li><strong>Backend & AI:</strong> AI features like list scanning and item generation are powered by Google&apos;s Gemini models via Genkit.</li>
                  <li><strong>Data Storage:</strong> List data and user authentication are handled by Firebase (Firestore and Firebase Authentication). Scanned images are stored in Firebase Storage.</li>
                  <li><strong>Development:</strong> This application was primarily developed with AI assistance from Firebase Studio&apos;s App Prototyper.</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

        </div>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;


# Listify

This is a mobile-first web app for scanning and managing lists. It can recognize handwritten and printed text as well as arbitrary collections of objects, turning them into manageable checklists. Users can also import text to be converted.

To get started, take a look at src/app/page.tsx.

## Major Features

*   **List Creation & Management:** Create, edit, complete, and delete lists and items.
*   **AI Image Scanning:** Scan handwritten notes, printed text, or physical objects via camera using the 'Scan' feature to create/update lists.
*   **Dictate or Paste:** Use your mobile device's keyboard dictation or paste text into a dialog using the 'Dictate or Paste' feature; AI then converts it to a structured list.
*   **Image Cropping:** Option to crop images before AI processing for better accuracy.
*   **AI Item Autogeneration:** Suggests new list items based on the list's title and existing content (up to 50 items) directly, without an intermediate dialog.
*   **User Authentication:** Google Sign-In for saving and syncing lists, and enabling list sharing. Core AI features (scanning, import, autogeneration) are available without sign-in.
*   **List Organization:** Active lists displayed prominently; completed lists in a collapsible, lazy-loaded section.
*   **Multiple Scan Viewing:** Save and view multiple scanned images per list with zoom functionality (requires sign-in to persist images).
*   **Utility Actions:** Copy list content, delete completed items, and delete entire lists (with confirmation).
*   **Help & Information:** In-app help screen explaining features and technical details.

## Technology & How It Works

Listify is a full-stack web application built with modern technologies:

*   **Frontend Framework:** [Next.js](https://nextjs.org/) (using the App Router) with [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/) for building the user interface.
*   **UI Components:** [ShadCN UI](https://ui.shadcn.com/) for pre-built, accessible, and customizable React components.
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first CSS styling.
*   **AI & Backend Logic:**
    *   [Genkit](https://firebase.google.com/docs/genkit) (an open-source framework from Firebase) is used to define and manage AI flows.
    *   **AI Model:** Google's `gemini-2.0-flash` model (via Genkit's Google AI plugin) is used for image recognition (extracting list titles and items from images), text interpretation (from imported text), and for generating new subitem suggestions.
*   **Database, Authentication & Storage:**
    *   [Firebase Firestore](https://firebase.google.com/docs/firestore) (a NoSQL cloud database) is used to store list data and user information.
    *   [Firebase Authentication](https://firebase.google.com/docs/auth) handles user sign-in with Google.
    *   [Firebase Storage](https://firebase.google.com/docs/storage) is used to store the scanned images.
*   **Development Environment:** This application was primarily developed with AI assistance from Firebase Studio's App Prototyper.

The application allows users to create lists manually, by scanning images, or by dictating/pasting text. When an image is scanned, it's sent to a Genkit AI flow that uses Gemini to interpret the image content. When text is dictated/pasted, it's processed by a similar Genkit flow. These flows attempt to identify a list title and individual items. These are then used to create a new list or append to an existing one. Similarly, the autogenerate feature uses a Genkit flow to call Gemini with the list's context to suggest new items. All list data is persisted in Firestore per user if signed in; otherwise, it's stored locally in the browser.

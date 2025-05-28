
# Listify

This is a mobile-first web app for scanning and managing lists. It can recognize handwritten and printed text as well as arbitrary collections of objects, turning them into manageable checklists.

To get started, take a look at src/app/page.tsx.

## Major Features

*   **List Creation & Management:**
    *   Create new lists with custom titles.
    *   Add, edit, complete, and delete individual items within lists.
*   **AI-Powered Image Scanning:**
    *   Scan handwritten notes, printed text, or even physical objects using your device camera.
    *   The AI interprets the image to create a new list or add items to an existing list.
    *   Option to crop the image before processing for better accuracy.
*   **AI-Powered Item Autogeneration:**
    *   Suggests new items for a list based on its title and existing content.
    *   The AI can generate a variable number of items, up to 50, depending on the list's context (e.g., more for recipes or well-defined sets).
*   **User Authentication:**
    *   Sign in with your Google account to save and sync your lists.
    *   Lists are user-specific, ensuring privacy.
*   **List Organization:**
    *   Active lists are displayed prominently.
    *   Completed lists are moved to a collapsible "Completed" section, which loads them on demand.
*   **Scan Viewing:**
    *   Save scanned images associated with your lists.
    *   View multiple scans per list with zoom-in/out functionality.
*   **Utility Actions:**
    *   Copy list content (title and items with completion status) to the clipboard.
    *   Delete all completed items from a list with a confirmation step.
    *   Delete entire lists with confirmation.
*   **Help & Information:**
    *   In-app help screen explaining key features and technical details.

## Technology & How It Works

Listify is a full-stack web application built with modern technologies:

*   **Frontend Framework:** [Next.js](https://nextjs.org/) (using the App Router) with [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/) for building the user interface.
*   **UI Components:** [ShadCN UI](https://ui.shadcn.com/) for pre-built, accessible, and customizable React components.
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) for utility-first CSS styling.
*   **AI & Backend Logic:**
    *   [Genkit](https://firebase.google.com/docs/genkit) (an open-source framework from Firebase) is used to define and manage AI flows.
    *   **AI Model:** Google's `gemini-2.0-flash` model (via Genkit's Google AI plugin) is used for image recognition (extracting list titles and items from images) and for generating new subitem suggestions.
*   **Database, Authentication & Storage:**
    *   [Firebase Firestore](https://firebase.google.com/docs/firestore) (a NoSQL cloud database) is used to store list data and user information.
    *   [Firebase Authentication](https://firebase.google.com/docs/auth) handles user sign-in with Google.
    *   [Firebase Storage](https://firebase.google.com/docs/storage) is used to store the scanned images.
*   **Development Environment:** This application was primarily developed with AI assistance from Firebase Studio's App Prototyper.

The application allows users to create lists manually or by scanning images. When an image is scanned, it's sent to a Genkit AI flow that uses Gemini to interpret the image content. The flow attempts to identify a list title and individual items (or objects if no clear list is found). These are then used to create a new list or append to an existing one. Similarly, the autogenerate feature uses a Genkit flow to call Gemini with the list's context to suggest new items. All list data is persisted in Firestore per user.

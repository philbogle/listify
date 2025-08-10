
'use server';
/**
 * @fileOverview An AI flow to extract a parent list title and subitem items from an image of a handwritten list.
 * If no handwritten list is found, it attempts to identify objects in the image and list them.
 * - extractListFromImage - A function that handles the list extraction from an image.
 * - ExtractListFromImageInput - The input type for the extractListFromImage function.
 * - ExtractListFromImageOutput - The return type for the extractListFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractListFromImageInputSchema = z.object({ // Renamed schema
  imageDataUri: z
    .string()
    .describe(
      "A photo, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'. This could be a handwritten list or a general scene."
    ),
});
export type ExtractListFromImageInput = z.infer<typeof ExtractListFromImageInputSchema>; // Renamed type

const ExtractedSubitemSchema = z.object({
  title: z.string().describe("The title of an extracted subitem or an identified object."),
});

const ExtractListFromImageOutputSchema = z.object({ // Renamed schema
  parentListTitle: z // Renamed field
    .string()
    .describe(
      "A concise and descriptive title for the main list. If a handwritten list is found, summarize its content (e.g., 'Grocery Run', 'Weekend Chores'). If no handwritten list is found but objects are identified, describe the scene or collection of objects (e.g., 'Objects in Living Room', 'Items on Desk'). If nothing recognizable is found, use a generic title like 'Unrecognized Image Content'."
    ),
  extractedSubitems: z // Renamed field
    .array(ExtractedSubitemSchema)
    .describe("An array of subitems. If a handwritten list is found, these are the list items. If no handwritten list is found, these are the names of identified objects in the image."),
});
export type ExtractListFromImageOutput = z.infer<typeof ExtractListFromImageOutputSchema>; // Renamed type

export async function extractListFromImage(input: ExtractListFromImageInput): Promise<ExtractListFromImageOutput> { // Renamed function
  return extractListFlow(input); // Renamed flow
}

const prompt = ai.definePrompt({
  name: 'extractListFromImagePrompt', // Renamed prompt
  input: {schema: ExtractListFromImageInputSchema},
  output: {schema: ExtractListFromImageOutputSchema},
  prompt: `You are an AI assistant with two primary tasks for image interpretation:

1.  **Primary Task: Handwritten List Extraction**
    *   First, carefully analyze the provided image to determine if it contains a handwritten list.
    *   If a handwritten list is clearly identifiable:
        *   Generate a 'parentListTitle' that is concise and descriptive of the list's content (e.g., "Grocery Run for Weekend", "Meeting Action Items", "Home Renovation Todos").
        *   Extract each distinct handwritten item and return these as 'extractedSubitems'.

2.  **Secondary Task: Object Identification (If No Handwritten List)**
    *   If, and only if, you do not find a clear handwritten list in the image:
        *   Attempt to identify distinct objects or elements visible in the image.
        *   Generate a 'parentListTitle' that describes the scene or the collection of objects (e.g., "Objects in Living Room", "Items on Desk", "Identified Items from Image").
        *   List the names of these identified objects as 'extractedSubitems', each with a 'title'. Aim for 3-7 items if possible.

**General Guidelines:**
*   If the image is entirely blank, unrecognizable, or contains no discernible handwritten list or identifiable objects, use a 'parentListTitle' like "Unrecognized Image Content" or "No actionable content found" and an empty 'extractedSubitems' array.
*   Prioritize handwritten list extraction. Only proceed to general object identification if no handwritten list is found.

Return the result with "parentListTitle" and an array of "extractedSubitems".

Image: {{media url=imageDataUri}}`,
});

const extractListFlow = ai.defineFlow( // Renamed flow
  {
    name: 'extractListFlow', // Renamed flow
    inputSchema: ExtractListFromImageInputSchema,
    outputSchema: ExtractListFromImageOutputSchema,
  },
  async (input: ExtractListFromImageInput) => {
    try {
      console.log(`[extractListFlow] Attempting to extract list or objects from image. Data URI length: ${input.imageDataUri.length}`);
      const {output} = await prompt(input);

      if (!output) {
        console.warn("[extractListFlow] AI output was null. Returning default error structure.");
        return { parentListTitle: "Error processing image", extractedSubitems: [] };
      }
      console.log(`[extractListFlow] AI successfully processed image. Title: "${output.parentListTitle}", Items: ${output.extractedSubitems.length}`);
      return output;

    } catch (error: any) {
      console.error(`[extractListFlow] Error during AI prompt execution: Message: ${error.message}, Stack: ${error.stack}`, error);
      // Rethrow the error so it's caught by the calling Server Component/Action and logged by Next.js/hosting environment
      throw error;
    }
  }
);

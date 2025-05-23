
'use server';
/**
 * @fileOverview An AI flow to extract a parent list title and subitem items from an image of a handwritten list.
 *
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
      "A photo of a handwritten list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractListFromImageInput = z.infer<typeof ExtractListFromImageInputSchema>; // Renamed type

const ExtractedSubitemSchema = z.object({ // Renamed schema
  title: z.string().describe("The title of an extracted subitem."),
});

const ExtractListFromImageOutputSchema = z.object({ // Renamed schema
  parentListTitle: z // Renamed field
    .string()
    .describe(
      "A concise and descriptive title for the main list, summarizing its content (e.g., 'Grocery Run', 'Weekend Chores', 'Project X Todos'). If a clear theme isn't obvious, use a generic title like 'Imported List'." // Changed example
    ),
  extractedSubitems: z // Renamed field
    .array(ExtractedSubitemSchema)
    .describe("A list of subitems extracted from the image."), // Changed description
});
export type ExtractListFromImageOutput = z.infer<typeof ExtractListFromImageOutputSchema>; // Renamed type

export async function extractListFromImage(input: ExtractListFromImageInput): Promise<ExtractListFromImageOutput> { // Renamed function
  return extractListFlow(input); // Renamed flow
}

const prompt = ai.definePrompt({
  name: 'extractListFromImagePrompt', // Renamed prompt
  input: {schema: ExtractListFromImageInputSchema},
  output: {schema: ExtractListFromImageOutputSchema},
  prompt: `You are an AI assistant specialized in interpreting images of handwritten notes and converting them into a structured list.
Your goal is to:
1.  Determine a concise and descriptive overall title for the list itself (e.g., "Grocery Run for Weekend", "Meeting Action Items", "Home Renovation Todos"). This will be the 'parentListTitle'. If the image does not seem to contain a list or if a clear theme isn't obvious, use a generic title like "Imported List from Image".
2.  Analyze the provided image to identify distinct handwritten items. These will be the 'extractedSubitems'.
3.  Extract the text for each item, focusing on clear, actionable titles. Ignore any unrelated drawings, numbers, or text that does not seem like an item for the list.

Return the result with "parentListTitle" and an array of "extractedSubitems", where each subitem object has a "title" field.
If no specific items are found but a general context can be determined for a list (e.g., an empty shopping list), still provide a 'parentListTitle' and an empty 'extractedSubitems' array. If the image is not a list at all, use a parentListTitle like "No list found in image" and an empty 'extractedSubitems' array.

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
      console.log(`[extractListFlow] Attempting to extract list from image. Data URI length: ${input.imageDataUri.length}`);
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


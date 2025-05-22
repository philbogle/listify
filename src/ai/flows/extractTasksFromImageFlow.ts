
'use server';
/**
 * @fileOverview An AI flow to extract a parent task title and subtask items from an image of a handwritten list.
 *
 * - extractTasksFromImage - A function that handles the task extraction from an image.
 * - ExtractTasksFromImageInput - The input type for the extractTasksFromImage function.
 * - ExtractTasksFromImageOutput - The return type for the extractTasksFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractTasksFromImageInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a handwritten task list, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractTasksFromImageInput = z.infer<typeof ExtractTasksFromImageInputSchema>;

const ExtractedSubtaskSchema = z.object({
  title: z.string().describe("The title of an extracted subtask item."),
});

const ExtractTasksFromImageOutputSchema = z.object({
  parentTaskTitle: z
    .string()
    .describe(
      "A concise and descriptive title for the main list, summarizing its content (e.g., 'Grocery Run', 'Weekend Chores', 'Project X Todos'). If a clear theme isn't obvious, use a generic title like 'Imported Task List'."
    ),
  extractedSubtasks: z
    .array(ExtractedSubtaskSchema)
    .describe("A list of subtask items extracted from the image."),
});
export type ExtractTasksFromImageOutput = z.infer<typeof ExtractTasksFromImageOutputSchema>;

export async function extractTasksFromImage(input: ExtractTasksFromImageInput): Promise<ExtractTasksFromImageOutput> {
  return extractTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTasksFromImagePrompt',
  input: {schema: ExtractTasksFromImageInputSchema},
  output: {schema: ExtractTasksFromImageOutputSchema},
  prompt: `You are an AI assistant specialized in interpreting images of handwritten notes and converting them into a structured list.
Your goal is to:
1.  Determine a concise and descriptive overall title for the list itself (e.g., "Grocery Run for Weekend", "Meeting Action Items", "Home Renovation Todos"). This will be the 'parentTaskTitle'. If the image does not seem to contain a list or if a clear theme isn't obvious, use a generic title like "Imported Tasks from Image".
2.  Analyze the provided image to identify distinct handwritten items. These will be the 'extractedSubtasks'.
3.  Extract the text for each item, focusing on clear, actionable titles. Ignore any unrelated drawings, numbers, or text that does not seem like a task item.

Return the result with "parentTaskTitle" and an array of "extractedSubtasks", where each subtask object has a "title" field.
If no specific items are found but a general context can be determined for a list (e.g., an empty shopping list), still provide a 'parentTaskTitle' and an empty 'extractedSubtasks' array. If the image is not a list at all, use a parentTaskTitle like "No list found in image" and an empty 'extractedSubtasks' array.

Image: {{media url=imageDataUri}}`,
});

const extractTasksFlow = ai.defineFlow(
  {
    name: 'extractTasksFlow',
    inputSchema: ExtractTasksFromImageInputSchema,
    outputSchema: ExtractTasksFromImageOutputSchema,
  },
  async (input: ExtractTasksFromImageInput) => {
    const {output} = await prompt(input);
    // Ensure output is not null and conforms to the schema, providing a default if necessary.
    return output || { parentTaskTitle: "Error processing image", extractedSubtasks: [] };
  }
);

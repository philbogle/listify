
'use server';
/**
 * @fileOverview An AI flow to extract task titles from an image of a handwritten list.
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

const ExtractedTaskSchema = z.object({
  title: z.string().describe("The title of an extracted task."),
});

const ExtractTasksFromImageOutputSchema = z.object({
  extractedTasks: z
    .array(ExtractedTaskSchema)
    .describe("A list of tasks extracted from the image."),
});
export type ExtractTasksFromImageOutput = z.infer<typeof ExtractTasksFromImageOutputSchema>;

export async function extractTasksFromImage(input: ExtractTasksFromImageInput): Promise<ExtractTasksFromImageOutput> {
  return extractTasksFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTasksFromImagePrompt',
  input: {schema: ExtractTasksFromImageInputSchema},
  output: {schema: ExtractTasksFromImageOutputSchema},
  prompt: `You are an AI assistant specialized in interpreting images of handwritten notes and converting them into a structured list of tasks.
Analyze the provided image, identify distinct handwritten task items, and extract the text for each task.
Focus on clear, actionable task titles. Ignore any unrelated drawings, numbers, or text that does not seem like a task item.
Return the tasks as a list of objects, where each object has a "title" field containing the task text.
If no tasks are found, return an empty list for "extractedTasks".

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
    return output || { extractedTasks: [] };
  }
);

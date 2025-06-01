
'use server';
/**
 * @fileOverview An AI flow to extract a parent list title and subitem items from a block of text.
 * - extractListFromText - A function that handles the list extraction from text.
 * - ExtractListFromTextInput - The input type for the extractListFromText function.
 * - ExtractListFromTextOutput - The return type for the extractListFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractListFromTextInputSchema = z.object({
  textToProcess: z
    .string()
    .describe(
      "A block of text, typically from speech-to-text, that may contain a list title and several list items."
    ),
});
export type ExtractListFromTextInput = z.infer<typeof ExtractListFromTextInputSchema>;

const ExtractedSubitemSchema = z.object({
  title: z.string().describe("The title of an extracted subitem."),
});

const ExtractListFromTextOutputSchema = z.object({
  parentListTitle: z
    .string()
    .describe(
      "A concise and descriptive title for the main list, derived from the text. If no clear title is found, use a generic one like 'My Dictated List'."
    ),
  extractedSubitems: z
    .array(ExtractedSubitemSchema)
    .describe("An array of subitems extracted from the text."),
});
export type ExtractListFromTextOutput = z.infer<typeof ExtractListFromTextOutputSchema>;

export async function extractListFromText(input: ExtractListFromTextInput): Promise<ExtractListFromTextOutput> {
  return extractListFromTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractListFromTextPrompt',
  input: {schema: ExtractListFromTextInputSchema},
  output: {schema: ExtractListFromTextOutputSchema},
  prompt: `You are an AI assistant tasked with parsing a block of text (likely from speech-to-text) to create a structured list.

Your goals are:
1.  Identify a suitable 'parentListTitle' from the text. This should be a concise summary or the stated name of the list. If no clear title is present, use a generic title like "My Dictated List" or "Notes from Dictation".
2.  Extract individual 'extractedSubitems' from the text. Each item should be a distinct to-do or piece of information. Try to separate items clearly.

Example Input Text:
"Okay, let's make a shopping list. I need apples, bananas, milk. Also, don't forget bread. And maybe some cheese."

Example Output:
{
  "parentListTitle": "Shopping List",
  "extractedSubitems": [
    { "title": "Apples" },
    { "title": "Bananas" },
    { "title": "Milk" },
    { "title": "Bread" },
    { "title": "Cheese" }
  ]
}

Another Example Input Text:
"Weekend chores. Mow the lawn. Wash the car. Pay bills."

Example Output:
{
  "parentListTitle": "Weekend Chores",
  "extractedSubitems": [
    { "title": "Mow the lawn" },
    { "title": "Wash the car" },
    { "title": "Pay bills" }
  ]
}

If the text is very short and seems like a single item or a title, try your best.
Input Text: "Remember to call John"
Output:
{
  "parentListTitle": "Reminder",
  "extractedSubitems": [
    { "title": "Call John" }
  ]
}

Input Text: "Meeting notes"
Output:
{
  "parentListTitle": "Meeting notes",
  "extractedSubitems": []
}


Process the following text:
{{{textToProcess}}}

Return the result with "parentListTitle" and an array of "extractedSubitems".
`,
});

const extractListFromTextFlow = ai.defineFlow(
  {
    name: 'extractListFromTextFlow',
    inputSchema: ExtractListFromTextInputSchema,
    outputSchema: ExtractListFromTextOutputSchema,
  },
  async (input: ExtractListFromTextInput) => {
    try {
      console.log(`[extractListFromTextFlow] Attempting to extract list from text: "${input.textToProcess.substring(0, 100)}..."`);
      const {output} = await prompt(input);

      if (!output) {
        console.warn("[extractListFromTextFlow] AI output was null. Returning default error structure.");
        return { parentListTitle: "Error processing text", extractedSubitems: [] };
      }
      console.log(`[extractListFromTextFlow] AI successfully processed text. Title: "${output.parentListTitle}", Items: ${output.extractedSubitems.length}`);
      return output;

    } catch (error: any) {
      console.error(`[extractListFromTextFlow] Error during AI prompt execution: Message: ${error.message}, Stack: ${error.stack}`, error);
      throw error;
    }
  }
);

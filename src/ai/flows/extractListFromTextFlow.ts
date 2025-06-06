
'use server';
/**
 * @fileOverview An AI flow to extract a parent list title and subitem items from dictated text.
 * - extractListFromText - A function that handles the list extraction from text.
 * - ExtractListFromTextInput - The input type for the extractListFromText function.
 * - ExtractListFromTextOutput - The return type for the extractListFromText function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractListFromTextInputSchema = z.object({
  dictatedText: z
    .string()
    .describe('The transcribed text from user dictation or pasted text.'),
});
export type ExtractListFromTextInput = z.infer<typeof ExtractListFromTextInputSchema>;

const ExtractedTextSubitemSchema = z.object({
  title: z.string().describe("The title of an extracted subitem from the text. This should be the item itself, e.g., 'apples', 'bananas', not 'buy apples'."),
});

const ExtractListFromTextOutputSchema = z.object({
  parentListTitle: z
    .string()
    .describe(
      "A concise and descriptive title for the main list, derived from the dictated text. If the text is short and seems like a title itself, use it. If it's a few items, summarize them. If it's just one item, that can be the title."
    ),
  extractedSubitems: z
    .array(ExtractedTextSubitemSchema)
    .describe("An array of subitems. If the text clearly enumerates items, these are those items. The item titles should be extracted literally, without adding verbs like 'buy' or 'get'. For example, if the input is 'apples bananas pears', the items should be 'apples', 'bananas', 'pears'."),
});
export type ExtractListFromTextOutput = z.infer<typeof ExtractListFromTextOutputSchema>;

export async function extractListFromText(input: ExtractListFromTextInput): Promise<ExtractListFromTextOutput> {
  return extractListTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractListFromTextPrompt',
  input: {schema: ExtractListFromTextInputSchema},
  output: {schema: ExtractListFromTextOutputSchema},
  prompt: `You are an AI assistant helping to convert input text (from pasting or dictation) into a structured to-do list.

Your task is to:
1.  Analyze the provided 'dictatedText'.
2.  Determine a 'parentListTitle' for the list. This should be a concise summary or the main theme of the text.
    *   If the text sounds like a list title itself (e.g., "Weekend Chores"), use that.
    *   If the text enumerates several items (e.g., "get milk, bread, and eggs"), create a title like "Grocery List" or "Shopping Items".
    *   If the text is a single item or phrase (e.g., "plan birthday party"), that can be the title.
    *   If no clear title can be derived, use a generic one like "My Imported List" or "Tasks from Input".
3.  Extract individual actionable items from the text to populate 'extractedSubitems'.
    *   If the text clearly lists items (e.g., "apples, pay bills, call mom"), each of these should be a subitem.
    *   **Crucially, extract the item titles as literally as possible. Do NOT add verbs like "buy", "get", "do", etc., unless they are explicitly part of the input text for that item.**
    *   For example, if the input is "apples bananas pears", the subitem titles should be "apples", "bananas", "pears".
    *   If the input is "call mom, fix sink", the subitem titles should be "call mom", "fix sink".
    *   If the text is a single task (e.g., "finish the report"), that task itself can be the only subitem, or you can leave subitems empty if the title captures it.
    *   If the text is very short and seems like just a title (e.g., "Vacation Ideas"), you can return an empty 'extractedSubitems' array.

Return the result with "parentListTitle" and an array of "extractedSubitems". Handle short or ambiguous text gracefully.

Input Text:
"{{{dictatedText}}}"
`,
});

const extractListTextFlow = ai.defineFlow(
  {
    name: 'extractListTextFlow',
    inputSchema: ExtractListFromTextInputSchema,
    outputSchema: ExtractListFromTextOutputSchema,
  },
  async (input: ExtractListFromTextInput) => {
    try {
      console.log(`[extractListTextFlow] Attempting to extract list from text: "${input.dictatedText.substring(0, 50)}..."`);
      const {output} = await prompt(input);

      if (!output) {
        console.warn("[extractListTextFlow] AI output was null. Returning default error structure.");
        return { parentListTitle: "Error processing text", extractedSubitems: [] };
      }
      console.log(`[extractListTextFlow] AI successfully processed text. Title: "${output.parentListTitle}", Items: ${output.extractedSubitems.length}`);
      return output;

    } catch (error: any) {
      console.error(`[extractListTextFlow] Error during AI prompt execution: Message: ${error.message}, Stack: ${error.stack}`, error);
      throw error; 
    }
  }
);

    
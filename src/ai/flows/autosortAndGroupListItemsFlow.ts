
'use server';
/**
 * @fileOverview An AI flow to intelligently sort subitems within a list and group them with section headers.
 * - autosortAndGroupListItems - A function that handles the subitem sorting and grouping process.
 * - AutosortAndGroupListItemsInput - The input type for the function.
 * - AutosortAndGroupListItemsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SubitemForGroupingSchema = z.object({
  id: z.string().describe("The unique identifier of the subitem."),
  title: z.string().describe("The text content of the subitem."),
  completed: z.boolean().describe("The completion status of the subitem."),
  isHeader: z.boolean().describe("Whether this item is a section header.").default(false),
});
export type SubitemForGrouping = z.infer<typeof SubitemForGroupingSchema>;

const AutosortAndGroupListItemsInputSchema = z.object({
  listTitle: z
    .string()
    .describe('The title of the parent list, providing context for sorting (e.g., "Grocery Shopping", "Weekend Chores").'),
  subitems: z
    .array(SubitemForGroupingSchema)
    .describe('The array of subitems to be sorted. Each item includes its id, title, and completed status. This input array should only contain items, not pre-existing headers.'),
});
export type AutosortAndGroupListItemsInput = z.infer<typeof AutosortAndGroupListItemsInputSchema>;

const AutosortAndGroupListItemsOutputSchema = z.object({
  sortedSubitems: z
    .array(SubitemForGroupingSchema)
    .describe('The array of subitems and headers, returned in a new, intelligently sorted and grouped order. All original subitems must be present. New header items may be added.'),
});
export type AutosortAndGroupListItemsOutput = z.infer<typeof AutosortAndGroupListItemsOutputSchema>;

export async function autosortAndGroupListItems(input: AutosortAndGroupListItemsInput): Promise<AutosortAndGroupListItemsOutput> {
  return autosortAndGroupListItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autosortAndGroupListItemsPrompt',
  input: {schema: AutosortAndGroupListItemsInputSchema},
  output: {schema: AutosortAndGroupListItemsOutputSchema},
  prompt: `You are an intelligent list organization assistant. Your task is to reorder the provided 'subitems' for a list titled '{{listTitle}}' and group them under logical section headers.

Contextual Grouping Examples:
- If '{{listTitle}}' is a grocery list (e.g., "Grocery Shopping"), create headers like "Produce", "Dairy & Eggs", "Meat & Seafood", "Pantry Staples", "Frozen Foods" and group the items under them.
- If '{{listTitle}}' is a to-do list (e.g., "Weekend Chores"), you might group by location ("Inside", "Outside") or by type of task ("Cleaning", "Errands").
- If '{{listTitle}}' is a packing list (e.g., "Camping Trip"), create headers like "Clothing", "Toiletries", "Gear", "Food".

General Instructions:
- Analyze the 'listTitle' ("{{listTitle}}") and the content of the 'subitems' to understand the list's purpose.
- Create new subitems with 'isHeader' set to true to act as section titles. These headers should be concise (e.g., "Produce", not "Items from the produce section").
- Arrange the original subitems under the appropriate new headers.
- If an item doesn't fit a clear group, it can be left under a general header like "Miscellaneous" or at the end of the list.
- If the list is short or too diverse to group meaningfully, you may return it with minimal or no headers.
- You MUST return all subitems provided in the input.
- You MUST preserve the original 'id', 'title', and 'completed' status for each original subitem.
- For new header items you create, the 'id' must be a new UUID, 'completed' must be false, and 'isHeader' must be true.

Input List Title: "{{listTitle}}"
Subitems to Sort and Group:
{{#each subitems}}
- ID: {{this.id}}, Title: "{{this.title}}", Completed: {{this.completed}}
{{/each}}

Return the entire list of items and new headers in the 'sortedSubitems' field, reordered and grouped according to these instructions.
`,
});

const autosortAndGroupListItemsFlow = ai.defineFlow(
  {
    name: 'autosortAndGroupListItemsFlow',
    inputSchema: AutosortAndGroupListItemsInputSchema,
    outputSchema: AutosortAndGroupListItemsOutputSchema,
  },
  async (input: AutosortAndGroupListItemsInput) => {
    try {
      console.log(`[autosortAndGroupFlow] Attempting to sort and group ${input.subitems.length} items for list: "${input.listTitle}"`);
      const {output} = await prompt(input);

      if (!output || !output.sortedSubitems) {
        console.warn("[autosortAndGroupFlow] AI output was null or did not contain sortedSubitems. Returning original order.");
        return { sortedSubitems: input.subitems };
      }

      const originalIds = new Set(input.subitems.map(item => item.id));
      const returnedItemIds = new Set(output.sortedSubitems.filter(item => !item.isHeader).map(item => item.id));
      
      if (originalIds.size !== returnedItemIds.size || !input.subitems.every(item => returnedItemIds.has(item.id))) {
        console.warn("[autosortAndGroupFlow] AI output missing original items or has different count. Returning original order.");
        return { sortedSubitems: input.subitems };
      }
      
      console.log(`[autosortAndGroupFlow] AI successfully processed. Title: "${input.listTitle}". Items returned: ${output.sortedSubitems.length}`);
      return output;

    } catch (error: any) {
      console.error(`[autosortAndGroupFlow] Error during AI prompt execution: Message: ${error.message}, Stack: ${error.stack}`, error);
      return { sortedSubitems: input.subitems };
    }
  }
);


'use server';
/**
 * @fileOverview An AI flow to intelligently sort subitems within a list.
 * - autosortListItems - A function that handles the subitem sorting process.
 * - AutosortListItemsInput - The input type for the autosortListItems function.
 * - AutosortListItemsOutput - The return type for the autosortListItems function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SubitemForSortSchema = z.object({
  id: z.string().describe("The unique identifier of the subitem."),
  title: z.string().describe("The text content of the subitem."),
  completed: z.boolean().describe("The completion status of the subitem."),
});
export type SubitemForSort = z.infer<typeof SubitemForSortSchema>;

const AutosortListItemsInputSchema = z.object({
  listTitle: z
    .string()
    .describe('The title of the parent list, providing context for sorting (e.g., "Grocery Shopping", "Weekend Chores").'),
  subitems: z
    .array(SubitemForSortSchema)
    .describe('The array of subitems to be sorted. Each item includes its id, title, and completed status.'),
});
export type AutosortListItemsInput = z.infer<typeof AutosortListItemsInputSchema>;

const AutosortListItemsOutputSchema = z.object({
  sortedSubitems: z
    .array(SubitemForSortSchema)
    .describe('The array of subitems, returned in a new, intelligently sorted order. All original subitems must be present with their original id and completed status unchanged.'),
});
export type AutosortListItemsOutput = z.infer<typeof AutosortListItemsOutputSchema>;

export async function autosortListItems(input: AutosortListItemsInput): Promise<AutosortListItemsOutput> {
  return autosortListItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'autosortListItemsPrompt',
  input: {schema: AutosortListItemsInputSchema},
  output: {schema: AutosortListItemsOutputSchema},
  prompt: `You are an intelligent list organization assistant. Your task is to reorder the provided 'subitems' for a list titled '{{listTitle}}' into a more logical or efficient sequence.

Contextual Sorting Examples:
- If '{{listTitle}}' is a grocery list (e.g., "Grocery Shopping", "Market Run"), group items by typical store sections or aisles (e.g., produce together, dairy together, frozen foods together, pantry staples together).
- If '{{listTitle}}' is a to-do list (e.g., "Weekend Chores", "Project Tasks", "Morning Routine"), order items by priority, logical sequence of execution, or by grouping similar tasks.
- If '{{listTitle}}' is a packing list (e.g., "Vacation Packing", "Camping Gear"), group items by category (e.g., clothes, toiletries, electronics, documents).
- If '{{listTitle}}' is a list of study topics (e.g., "History Exam Prep", "Learn JavaScript"), order by foundational concepts first, then more advanced ones, or chronologically if applicable.
- If '{{listTitle}}' is a recipe, order ingredients by their typical usage sequence in the recipe steps.

General Instructions:
- Analyze the 'listTitle' ("{{listTitle}}") and the content of the 'subitems' to understand the list's purpose.
- If the context is unclear or the items are too diverse for a specific logical grouping, try to group by similarity or maintain a general sensible order. If no meaningful reordering can be determined, you may return the items in their original relative order or a very basic grouping.
- You MUST return all subitems provided in the input.
- You MUST preserve the original 'id', 'title', and 'completed' status for each subitem. Do NOT modify the subitems themselves in any way other than their order in the array.
- Do NOT add any new subitems or remove any existing ones.

Input List Title: "{{listTitle}}"
Subitems to Sort:
{{#each subitems}}
- ID: {{this.id}}, Title: "{{this.title}}", Completed: {{this.completed}}
{{/each}}

Return the entire list of subitems in the 'sortedSubitems' field, reordered according to these instructions.
`,
});

const autosortListItemsFlow = ai.defineFlow(
  {
    name: 'autosortListItemsFlow',
    inputSchema: AutosortListItemsInputSchema,
    outputSchema: AutosortListItemsOutputSchema,
  },
  async (input: AutosortListItemsInput) => {
    try {
      console.log(`[autosortListItemsFlow] Attempting to sort ${input.subitems.length} items for list: "${input.listTitle}"`);
      const {output} = await prompt(input);

      if (!output || !output.sortedSubitems) {
        console.warn("[autosortListItemsFlow] AI output was null or did not contain sortedSubitems. Returning original order.");
        return { sortedSubitems: input.subitems };
      }

      // Basic validation: Ensure all original IDs are present in the sorted output
      const originalIds = new Set(input.subitems.map(item => item.id));
      const sortedIds = new Set(output.sortedSubitems.map(item => item.id));
      if (originalIds.size !== sortedIds.size || !input.subitems.every(item => sortedIds.has(item.id))) {
        console.warn("[autosortListItemsFlow] AI output missing original items or has different count. Returning original order.");
        return { sortedSubitems: input.subitems };
      }
      
      // Ensure original properties are maintained (title, completed status)
      const subitemsMap = new Map(input.subitems.map(item => [item.id, item]));
      const validatedSortedSubitems = output.sortedSubitems.map(sortedItem => {
        const originalItem = subitemsMap.get(sortedItem.id);
        return {
          ...sortedItem, // Take the order from AI
          title: originalItem?.title || sortedItem.title, // Prioritize original title
          completed: originalItem?.completed !== undefined ? originalItem.completed : sortedItem.completed, // Prioritize original completed status
        };
      });


      console.log(`[autosortListItemsFlow] AI successfully processed sorting for list: "${input.listTitle}". Items returned: ${validatedSortedSubitems.length}`);
      return { sortedSubitems: validatedSortedSubitems };

    } catch (error: any) {
      console.error(`[autosortListItemsFlow] Error during AI prompt execution: Message: ${error.message}, Stack: ${error.stack}`, error);
      // In case of error, return the original items to avoid data loss or corruption.
      return { sortedSubitems: input.subitems };
    }
  }
);


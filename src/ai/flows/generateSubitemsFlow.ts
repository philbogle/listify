
'use server';
/**
 * @fileOverview An AI flow to generate new subitem titles for a list.
 *
 * - generateSubitemsForList - A function that handles the subitem generation.
 * - GenerateSubitemsInput - The input type for the generateSubitemsForList function.
 * - GenerateSubitemsOutput - The return type for the generateSubitemsForList function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSubitemsInputSchema = z.object({
  listTitle: z.string().describe('The title of the parent list for which to generate subitems.'),
  existingSubitemTitles: z.array(z.string()).describe('A list of titles of subitems that already exist in the list, to avoid duplicates.'),
});
export type GenerateSubitemsInput = z.infer<typeof GenerateSubitemsInputSchema>;

const GenerateSubitemsOutputSchema = z.object({
  newSubitemTitles: z.array(z.string().describe("A unique, newly generated subitem title.")).describe("An array of new subitem titles. The number of items can vary."),
});
export type GenerateSubitemsOutput = z.infer<typeof GenerateSubitemsOutputSchema>;

export async function generateSubitemsForList(input: GenerateSubitemsInput): Promise<GenerateSubitemsOutput> {
  return generateSubitemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSubitemsPrompt',
  input: {schema: GenerateSubitemsInputSchema},
  output: {schema: GenerateSubitemsOutputSchema},
  prompt: `You are a creative assistant helping to populate a list titled "{{listTitle}}".
Your task is to generate a helpful number (e.g., between 3 and 7) of new, unique, and actionable sub-item titles that fit the theme of this list.

The list currently contains the following items (if any):
{{#if existingSubitemTitles}}
{{#each existingSubitemTitles}}
- {{this}}
{{/each}}
{{else}}
(This list is currently empty)
{{/if}}

The new items you generate MUST be distinct from these existing items and from each other. They should be concise and clear.
Focus on generating items that would naturally belong to a list with the title "{{listTitle}}".

Return an array of strings in the 'newSubitemTitles' field. Do not add any other commentary.
For example, if the list title is "Weekend Chores", you might suggest items like "Clean bathroom", "Mow lawn", "Grocery shopping for next week", "Organize garage", "Plan meals", "Take out recycling".
If the list title is "Book Ideas", you might suggest items like "Sci-fi novel about space exploration", "Children's book about a talking animal", "Historical fiction set in ancient Rome", "Mystery thriller with a detective protagonist", "Fantasy series with magical creatures", "Self-help book on productivity".
`,
});

const generateSubitemsFlow = ai.defineFlow(
  {
    name: 'generateSubitemsFlow',
    inputSchema: GenerateSubitemsInputSchema,
    outputSchema: GenerateSubitemsOutputSchema,
  },
  async (input: GenerateSubitemsInput) => {
    const {output} = await prompt(input);
    if (!output?.newSubitemTitles || output.newSubitemTitles.length === 0) {
        console.warn("AI did not return any subitems or output was null. No new items will be added.");
        return { newSubitemTitles: [] };
    }
    return output;
  }
);



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
  promptForGeneration: z.string().describe('The prompt or context for which to generate subitems.'),
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
  prompt: `You are a creative assistant helping to populate a list based on the following prompt or context: "{{promptForGeneration}}".
Your task is to generate new, unique, and actionable sub-item titles that fit the theme of this prompt.

Guidelines for the number of items:
- For most common lists (e.g., "Weekend Chores", "Grocery Shopping", "Meeting Ideas"), aim for a smaller, more manageable number of suggestions (e.g., 3-7 items).
- If the prompt clearly indicates a context that implies a longer, more comprehensive, or well-defined set (e.g., "Recipe for Chocolate Cake", "All Stages of Project Phoenix", "Countries in South America", "Complete Packing List for Camping"), you may generate up to 15 items if appropriate for that specific context.
- Use your judgment based on the prompt to determine a helpful number of items.

The list currently contains the following items (if any):
{{#if existingSubitemTitles}}
{{#each existingSubitemTitles}}
- {{this}}
{{/each}}
{{else}}
(This list is currently empty)
{{/if}}

The new items you generate MUST be distinct from these existing items and from each other. They should be concise and clear.
Focus on generating items that would naturally belong to a list derived from the prompt "{{promptForGeneration}}".

Return an array of strings in the 'newSubitemTitles' field. Do not add any other commentary.
For example:
- If prompt is "Weekend Chores", you might suggest: "Clean bathroom", "Mow lawn", "Grocery shopping for next week", "Organize garage", "Plan meals", "Take out recycling". (6 items)
- If prompt is "Recipe: Spaghetti Carbonara Ingredients", you might suggest: "Spaghetti", "Guanciale or Pancetta", "Eggs (yolks)", "Pecorino Romano cheese", "Black pepper", "Salt". (6 items)
- If prompt is "All Planets in our Solar System", you might suggest: "Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune". (8 items)
`,
});

const generateSubitemsFlow = ai.defineFlow(
  {
    name: 'generateSubitemsFlow',
    inputSchema: GenerateSubitemsInputSchema,
    outputSchema: GenerateSubitemsOutputSchema,
  },
  async (input: GenerateSubitemsInput) => {
    try {
      console.log(`[generateSubitemsFlow] Attempting to generate subitems for prompt: "${input.promptForGeneration}" with ${input.existingSubitemTitles.length} existing items.`);
      const {output} = await prompt(input);
      
      if (!output?.newSubitemTitles) {
        console.warn("[generateSubitemsFlow] AI output was null or did not contain newSubitemTitles. Returning empty array.");
        return { newSubitemTitles: [] };
      }
      if (output.newSubitemTitles.length === 0) {
        console.log("[generateSubitemsFlow] AI returned 0 new subitems.");
      } else {
        console.log(`[generateSubitemsFlow] AI successfully generated ${output.newSubitemTitles.length} new subitems.`);
      }
      return output;

    } catch (error: any) {
      console.error(`[generateSubitemsFlow] Error during AI prompt execution: Message: ${error.message}, Stack: ${error.stack}`, error);
      // Rethrow the error so it's caught by the calling Server Component/Action and logged by Next.js/hosting environment
      // This will likely result in the generic server error on the client, but the detailed log above will be in server logs.
      throw error;
    }
  }
);


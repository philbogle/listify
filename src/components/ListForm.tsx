
"use client";

import type { FC } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// Textarea import removed
import { PlusCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { List } from "@/types/list"; 

const listFormSchema = z.object({ 
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  // description schema removed
});

type ListFormValues = z.infer<typeof listFormSchema>; 

interface ListFormProps { 
  onSubmit: (data: Omit<List, "id" | "completed" | "subitems" | "createdAt">) => Promise<void>; 
  onListAdded?: () => void; 
}

const ListForm: FC<ListFormProps> = ({ onSubmit, onListAdded }) => { 
  const form = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
    defaultValues: {
      title: "",
      // description default removed
    },
  });

  const handleFormSubmit: SubmitHandler<ListFormValues> = async (data) => {
    await onSubmit({
      title: data.title,
      // description submission removed
    });
    form.reset();
    onListAdded?.(); 
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>List Title</FormLabel> 
              <FormControl>
                <Input placeholder="Enter list title" {...field} /> 
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Description FormField removed */}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          <PlusCircle className="mr-2 h-5 w-5" />
          {form.formState.isSubmitting ? "Adding List..." : "Add List"} 
        </Button>
      </form>
    </Form>
  );
};

export default ListForm;

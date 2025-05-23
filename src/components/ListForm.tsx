
"use client";

import type { FC } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { List } from "@/types/list"; // Renamed import

const listFormSchema = z.object({ // Renamed schema
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
});

type ListFormValues = z.infer<typeof listFormSchema>; // Renamed type

interface ListFormProps { // Renamed interface
  onSubmit: (data: Omit<List, "id" | "completed" | "subitems" | "createdAt">) => Promise<void>; // Updated type
  onListAdded?: () => void; // Renamed callback
}

const ListForm: FC<ListFormProps> = ({ onSubmit, onListAdded }) => { // Renamed component and props
  const form = useForm<ListFormValues>({
    resolver: zodResolver(listFormSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const handleFormSubmit: SubmitHandler<ListFormValues> = async (data) => {
    await onSubmit({
      title: data.title,
      description: data.description,
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
              <FormLabel>List Title</FormLabel> {/* Changed label */}
              <FormControl>
                <Input placeholder="Enter list title" {...field} /> {/* Changed placeholder */}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter list description" {...field} /> {/* Changed placeholder */}
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          <PlusCircle className="mr-2 h-5 w-5" />
          {form.formState.isSubmitting ? "Adding List..." : "Add List"} {/* Changed button text */}
        </Button>
      </form>
    </Form>
  );
};

export default ListForm; // Renamed export

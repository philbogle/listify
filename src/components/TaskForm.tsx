
"use client";

import type { FC } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// Popover, Calendar, CalendarIcon, format removed as dueDate is removed
import { PlusCircle } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { Task } from "@/types/task";

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  // dueDate: z.date().optional(), // REMOVED
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  onSubmit: (data: Omit<Task, "id" | "completed" | "subtasks" | "createdAt">) => Promise<void>;
  onTaskAdded?: () => void; // Callback to close dialog
}

const TaskForm: FC<TaskFormProps> = ({ onSubmit, onTaskAdded }) => {
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  const handleFormSubmit: SubmitHandler<TaskFormValues> = async (data) => {
    await onSubmit({
      title: data.title,
      description: data.description,
      // dueDate: data.dueDate ? data.dueDate.toISOString() : undefined, // REMOVED
    });
    form.reset();
    onTaskAdded?.(); // Call the callback to close the dialog
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Task Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter task title" {...field} />
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
                <Textarea placeholder="Enter task description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* Due Date FormField REMOVED */}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          <PlusCircle className="mr-2 h-5 w-5" />
          {form.formState.isSubmitting ? "Adding Task..." : "Add Task"}
        </Button>
      </form>
    </Form>
  );
};

export default TaskForm;

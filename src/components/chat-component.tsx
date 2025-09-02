"use client";

import { useChat } from "@ai-sdk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message too long"),
});

type Props = {
  chatId: number;
};

export const ChatComponent = ({ chatId }: Props) => {
  const { messages, sendMessage } = useChat();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    void sendMessage({ text: values.message });
    form.reset();
  }

  return (
    <div className="hide-scrollbar relative h-screen overflow-y-scroll">
      <div className="sticky inset-x-0 top-0 h-fit bg-white p-2">
        <h3 className="text-xl font-bold">Chat</h3>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask a question..."
                      {...field}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={form.formState.isSubmitting}
                    >
                      Send
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  );
};

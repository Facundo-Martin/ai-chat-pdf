"use client";

import type React from "react";

import { useChat } from "@ai-sdk/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { MicIcon, GlobeIcon, AlertCircle } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputButton,
  PromptInputModelSelect,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Alert, AlertDescription } from "./ui/alert";

const modelEnum = z.enum(["gpt-4", "gpt-3.5-turbo", "claude-3"]);

const formSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(1000, "Message too long"),
  model: modelEnum,
});

const AI_MODELS = [
  { id: "gpt-4", name: "GPT-4" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "claude-3", name: "Claude 3" },
] as const;

type Props = {
  chatId: number;
};

export const ChatComponent = ({ chatId }: Props) => {
  const { messages, sendMessage, status } = useChat();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
      model: "gpt-4",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    void sendMessage(
      { text: values.message },
      {
        body: {
          model: values.model,
          chatId: chatId,
        },
      },
    );
    form.reset({
      message: "",
      model: values.model, // Preserve model selection after reset
    });
  }

  console.log(status);

  return (
    <div className="flex h-screen flex-col">
      <div className="bg-background sticky inset-x-0 top-0 h-fit border-b p-4">
        <h3 className="text-xl font-bold">Chat</h3>
      </div>
      <Conversation>
        <ConversationContent>
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text": // we don't use any reasoning or tool calls in this example
                      return (
                        <Response key={`${message.id}-${i}`}>
                          {part.text}
                        </Response>
                      );
                    default:
                      return null;
                  }
                })}
              </MessageContent>
            </Message>
          ))}
          {status === "error" && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>
                  An error occurred while processing your request. Please try
                  again.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="bg-background border-t p-4">
        <Form {...form}>
          <PromptInput onSubmit={form.handleSubmit(onSubmit)} className="mt-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PromptInputTextarea
                      {...field}
                      disabled={status === "streaming"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputButton type="button">
                  <MicIcon size={16} />
                </PromptInputButton>
                <PromptInputButton type="button">
                  <GlobeIcon size={16} />
                  <span>Search</span>
                </PromptInputButton>
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <PromptInputModelSelect
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <PromptInputModelSelectTrigger>
                            <PromptInputModelSelectValue />
                          </PromptInputModelSelectTrigger>
                          <PromptInputModelSelectContent>
                            {AI_MODELS.map((model) => (
                              <PromptInputModelSelectItem
                                key={model.id}
                                value={model.id}
                              >
                                {model.name}
                              </PromptInputModelSelectItem>
                            ))}
                          </PromptInputModelSelectContent>
                        </PromptInputModelSelect>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!form.watch("message") || form.formState.isSubmitting}
              />
            </PromptInputToolbar>
          </PromptInput>
        </Form>
      </div>
    </div>
  );
};

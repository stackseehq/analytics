'use client';

import { useChat } from '@ai-sdk/react';
import { Conversation } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageAvatar } from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '@/components/ai-elements/prompt-input';
import { Response } from '@/components/ai-elements/response';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SendIcon } from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';

interface EventLog {
  id: string;
  type: string;
  timestamp: number;
  data?: any;
}

export function PlaygroundClient() {
  const { messages, status, sendMessage } = useChat({
    api: '/api/playground',
  });

  const [input, setInput] = useState('');
  const [events, setEvents] = useState<EventLog[]>([]);

  const isLoading = status !== 'ready';

  // Monitor messages to track events
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const textContent = lastMessage.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');

      setEvents(prev => [
        ...prev,
        {
          id: `msg-${lastMessage.id}`,
          type: lastMessage.role === 'user' ? 'user-message' : 'assistant-message',
          timestamp: Date.now(),
          data: { role: lastMessage.role, contentLength: textContent.length },
        },
      ]);
    }
  }, [messages]);

  // Track loading state changes
  useEffect(() => {
    if (isLoading) {
      setEvents(prev => [
        ...prev,
        {
          id: `loading-${Date.now()}`,
          type: 'stream-start',
          timestamp: Date.now(),
        },
      ]);
    } else if (events.length > 0 && events[events.length - 1].type === 'stream-start') {
      setEvents(prev => [
        ...prev,
        {
          id: `complete-${Date.now()}`,
          type: 'stream-complete',
          timestamp: Date.now(),
        },
      ]);
    }
  }, [isLoading]);

  const clearEvents = () => setEvents([]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      {/* Chat UI - Left side (2/3 width) */}
      <div className="lg:col-span-2 flex flex-col h-full">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle>AI Elements Playground</CardTitle>
            <CardDescription>
              Interact with the chat to see events fire in real-time
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
            <Conversation className="flex-1 overflow-auto">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center space-y-2">
                    <p className="text-lg font-medium">Start a conversation</p>
                    <p className="text-sm">
                      Type a message below to see events streaming in real-time
                    </p>
                  </div>
                </div>
              )}
              {messages.map((message) => {
                // Extract text content from parts array
                const textContent = message.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => part.text)
                  .join('');

                return (
                  <Message key={message.id} from={message.role}>
                    <MessageAvatar
                      src={message.role === 'user' ? '/user-avatar.png' : '/ai-avatar.png'}
                      name={message.role === 'user' ? 'You' : 'AI'}
                    />
                    <MessageContent>
                      <Response>{textContent}</Response>
                    </MessageContent>
                  </Message>
                );
              })}
            </Conversation>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!input.trim()) return;
                sendMessage({ text: input });
                setInput('');
              }}
              className="flex gap-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Type your message here..."
                className="flex-1 resize-none"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!input.trim()) return;
                    sendMessage({ text: input });
                    setInput('');
                  }
                }}
              />
              <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
                <SendIcon className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Event Monitor - Right side (1/3 width) */}
      <div className="flex flex-col h-full">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div className="space-y-1">
              <CardTitle className="text-lg">Event Monitor</CardTitle>
              <CardDescription className="text-xs">
                Real-time event stream
              </CardDescription>
            </div>
            <button
              onClick={clearEvents}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto min-h-0">
            <div className="space-y-2">
              {events.length === 0 && (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  No events yet
                </div>
              )}
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border bg-card text-card-foreground text-xs space-y-1 animate-in slide-in-from-top-2 duration-200"
                  style={{ animationDelay: '0ms' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant={
                        event.type.includes('user')
                          ? 'default'
                          : event.type.includes('stream')
                          ? 'secondary'
                          : 'outline'
                      }
                      className="text-xs"
                    >
                      {event.type}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {event.data && (
                    <div className="text-muted-foreground text-[10px] font-mono bg-muted/50 p-2 rounded">
                      {JSON.stringify(event.data, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { streamText, convertToModelMessages } from 'ai';

// Create a mock provider that doesn't require API keys
const mockProvider = {
  chat(modelId: string) {
    return {
      specificationVersion: 'v2' as const,
      modelId,
      provider: 'mock',
      defaultObjectGenerationMode: 'json' as const,
      supportedUrls: [],

      async doGenerate(options: any) {
        // Not implemented for this demo
        throw new Error('doGenerate not implemented in mock provider');
      },

      async doStream(options: any) {
        const { prompt } = options;
        // Extract user message from the prompt
        const userMessage =
          prompt.find((msg: any) => msg.role === 'user')?.content?.[0]?.text || 'Hello';

        // Simulate streaming response with events
        return {
          stream: (async function* () {
            // Send thinking/reasoning events
            yield {
              type: 'text-delta',
              textDelta: "I'm analyzing your request... ",
            };

            await new Promise((resolve) => setTimeout(resolve, 500));

            yield {
              type: 'text-delta',
              textDelta: `You said: "${userMessage}". `,
            };

            await new Promise((resolve) => setTimeout(resolve, 500));

            yield {
              type: 'text-delta',
              textDelta: 'Let me demonstrate different types of events:\n\n',
            };

            await new Promise((resolve) => setTimeout(resolve, 300));

            // Simulate code generation
            yield {
              type: 'text-delta',
              textDelta: '```javascript\n',
            };

            const code = `function handleEvent(type) {
  console.log('Event fired:', type);
  // Process the event
  return { success: true };
}`;

            for (let i = 0; i < code.length; i += 3) {
              yield {
                type: 'text-delta',
                textDelta: code.slice(i, i + 3),
              };
              await new Promise((resolve) => setTimeout(resolve, 20));
            }

            yield {
              type: 'text-delta',
              textDelta: '\n```\n\n',
            };

            await new Promise((resolve) => setTimeout(resolve, 300));

            // Send more text
            yield {
              type: 'text-delta',
              textDelta: 'Here are some key points:\n',
            };

            const points = [
              '1. **Text streaming** - Watch as text appears character by character',
              '2. **Code highlighting** - Code blocks are properly formatted',
              '3. **Real-time updates** - The UI updates as events stream in',
            ];

            for (const point of points) {
              await new Promise((resolve) => setTimeout(resolve, 200));
              yield {
                type: 'text-delta',
                textDelta: `\n${point}`,
              };
            }

            yield {
              type: 'text-delta',
              textDelta: '\n\nThis is a live demonstration of AI Elements with streaming events! 🎉',
            };

            // Finish
            yield {
              type: 'finish',
              finishReason: 'stop',
              usage: {
                promptTokens: 10,
                completionTokens: 50,
              },
            };
          })(),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    };
  },
};

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: mockProvider.chat('gpt-4'),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
  });
}

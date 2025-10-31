import { PlaygroundClient } from './playground-client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Elements Playground',
  description: 'Interactive playground demonstrating AI Elements with real-time event streaming',
};

export default function PlaygroundPage() {
  return (
    <div className="container mx-auto py-8">
      <PlaygroundClient />
    </div>
  );
}

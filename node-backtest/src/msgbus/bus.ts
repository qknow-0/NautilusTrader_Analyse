// Simple pub/sub message bus with wildcard topic matching

type Handler = (data: unknown) => void;

interface Subscription {
  pattern: string;
  handler: Handler;
  id: string;
}

export class MessageBus {
  private subscriptions: Subscription[] = [];
  private idCounter = 0;

  subscribe(pattern: string, handler: Handler): string {
    const id = `sub-${++this.idCounter}`;
    this.subscriptions.push({ pattern, handler, id });
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions = this.subscriptions.filter((s) => s.id !== id);
  }

  publish(topic: string, data: unknown): void {
    for (const sub of this.subscriptions) {
      if (this.matchPattern(sub.pattern, topic)) {
        sub.handler(data);
      }
    }
  }

  private matchPattern(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;
    if (pattern === '*') return true;

    const patternParts = pattern.split('.');
    const topicParts = topic.split('.');

    if (patternParts.length !== topicParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      const p = patternParts[i];
      if (p === '*') continue;
      if (p === topicParts[i]) continue;
      return false;
    }

    return true;
  }
}

import type { WebSocket } from "ws";
import type { LiveActivityItem } from "@pact/shared";

type Socket = { send: (data: string) => void; readyState: number };

class ActivityHub {
  private clients = new Set<Socket>();
  private buffer: LiveActivityItem[] = [];

  subscribe(socket: Socket) {
    this.clients.add(socket);
    for (const item of this.buffer.slice(-50)) {
      socket.send(JSON.stringify({ type: "activity", item }));
    }
  }

  unsubscribe(socket: Socket) {
    this.clients.delete(socket);
  }

  publish(item: LiveActivityItem) {
    this.buffer.push(item);
    if (this.buffer.length > 200) this.buffer.shift();
    const payload = JSON.stringify({ type: "activity", item });
    for (const client of this.clients) {
      try {
        if (client.readyState === 1) client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  recent(limit = 50) {
    return this.buffer.slice(-limit).reverse();
  }
}

export const activityHub = new ActivityHub();

import { randomUUID } from 'node:crypto';

export interface PanelDraft {
  id: string;
  guildId: string;
  channelId: string;
  userId: string;
  imageUrl: string | null;
  expiresAt: number;
}

export class PanelDraftStore {
  private readonly drafts = new Map<string, PanelDraft>();
  private readonly lifetime = 15 * 60 * 1000;

  constructor() {
    setInterval(() => this.cleanup(), 60_000).unref();
  }

  create(input: Omit<PanelDraft, 'id' | 'expiresAt'>): PanelDraft {
    const draft: PanelDraft = {
      ...input,
      id: randomUUID(),
      expiresAt: Date.now() + this.lifetime
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }

  consume(id: string, userId: string): PanelDraft | null {
    const draft = this.drafts.get(id);
    this.drafts.delete(id);
    if (!draft || draft.userId !== userId || draft.expiresAt < Date.now()) return null;
    return draft;
  }

  delete(id: string): void {
    this.drafts.delete(id);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, draft] of this.drafts) {
      if (draft.expiresAt < now) this.drafts.delete(id);
    }
  }
}

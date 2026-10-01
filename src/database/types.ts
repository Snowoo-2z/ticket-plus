export type TicketStatus = 'OPEN' | 'CLOSED' | 'DELETED';

export interface GuildSettings {
  guildId: string;
  categoryId: string;
  supportRoleId: string | null;
  logChannelId: string | null;
  counter: number;
  updatedAt: number;
}

export interface Panel {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string | null;
  title: string;
  description: string;
  buttonLabel: string;
  welcomeTitle: string;
  welcomeDescription: string;
  imageUrl: string | null;
  createdBy: string;
  createdAt: number;
  active: boolean;
}

export interface Ticket {
  id: number;
  guildId: string;
  channelId: string;
  ownerId: string;
  panelId: string;
  number: number;
  status: TicketStatus;
  claimedBy: string | null;
  controlMessageId: string | null;
  channelName: string;
  createdAt: number;
  closedAt: number | null;
}

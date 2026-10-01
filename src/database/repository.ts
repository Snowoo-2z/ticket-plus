import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { GuildSettings, Panel, Ticket, TicketStatus } from './types';

interface SettingsRow {
  guild_id: string;
  category_id: string;
  support_role_id: string | null;
  log_channel_id: string | null;
  counter: number;
  updated_at: number;
}

interface PanelRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  title: string;
  description: string;
  button_label: string;
  welcome_title: string;
  welcome_description: string;
  image_url: string | null;
  created_by: string;
  created_at: number;
  active: number;
}

interface TicketRow {
  id: number;
  guild_id: string;
  channel_id: string;
  owner_id: string;
  panel_id: string;
  number: number;
  status: TicketStatus;
  claimed_by: string | null;
  control_message_id: string | null;
  channel_name: string;
  created_at: number;
  closed_at: number | null;
}

export interface CreatePanelInput {
  guildId: string;
  channelId: string;
  title: string;
  description: string;
  buttonLabel: string;
  welcomeTitle: string;
  welcomeDescription: string;
  imageUrl: string | null;
  createdBy: string;
}

export interface CreateTicketInput {
  guildId: string;
  channelId: string;
  ownerId: string;
  panelId: string;
  number: number;
  channelName: string;
}

const mapSettings = (row: SettingsRow): GuildSettings => ({
  guildId: row.guild_id,
  categoryId: row.category_id,
  supportRoleId: row.support_role_id,
  logChannelId: row.log_channel_id,
  counter: row.counter,
  updatedAt: row.updated_at
});

const mapPanel = (row: PanelRow): Panel => ({
  id: row.id,
  guildId: row.guild_id,
  channelId: row.channel_id,
  messageId: row.message_id,
  title: row.title,
  description: row.description,
  buttonLabel: row.button_label,
  welcomeTitle: row.welcome_title,
  welcomeDescription: row.welcome_description,
  imageUrl: row.image_url,
  createdBy: row.created_by,
  createdAt: row.created_at,
  active: row.active === 1
});

const mapTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  guildId: row.guild_id,
  channelId: row.channel_id,
  ownerId: row.owner_id,
  panelId: row.panel_id,
  number: row.number,
  status: row.status,
  claimedBy: row.claimed_by,
  controlMessageId: row.control_message_id,
  channelName: row.channel_name,
  createdAt: row.created_at,
  closedAt: row.closed_at
});

export class Repository {
  private readonly database: Database.Database;

  constructor(databasePath: string) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    this.database = new Database(databasePath);
    this.database.pragma('journal_mode = WAL');
    this.database.pragma('foreign_keys = ON');
    this.database.pragma('busy_timeout = 5000');
    this.migrate();
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        support_role_id TEXT,
        log_channel_id TEXT,
        counter INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS panels (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        button_label TEXT NOT NULL,
        welcome_title TEXT NOT NULL,
        welcome_description TEXT NOT NULL,
        image_url TEXT,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL UNIQUE,
        owner_id TEXT NOT NULL,
        panel_id TEXT NOT NULL,
        number INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('OPEN', 'CLOSED', 'DELETED')),
        claimed_by TEXT,
        control_message_id TEXT,
        channel_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        closed_at INTEGER,
        UNIQUE(guild_id, number),
        FOREIGN KEY(panel_id) REFERENCES panels(id)
      );

      CREATE TABLE IF NOT EXISTS ticket_members (
        ticket_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        added_at INTEGER NOT NULL,
        PRIMARY KEY(ticket_id, user_id),
        FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS tickets_owner_status_idx ON tickets(guild_id, owner_id, status);
      CREATE INDEX IF NOT EXISTS tickets_channel_idx ON tickets(channel_id);
      CREATE INDEX IF NOT EXISTS panels_guild_idx ON panels(guild_id);
    `);
  }

  getSettings(guildId: string): GuildSettings | null {
    const row = this.database.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as SettingsRow | undefined;
    return row ? mapSettings(row) : null;
  }

  configureGuild(
    guildId: string,
    categoryId: string,
    supportRoleId: string | null | undefined,
    logChannelId: string | null | undefined
  ): GuildSettings {
    const current = this.getSettings(guildId);
    const support = supportRoleId === undefined ? current?.supportRoleId ?? null : supportRoleId;
    const logs = logChannelId === undefined ? current?.logChannelId ?? null : logChannelId;
    const now = Date.now();
    this.database.prepare(`
      INSERT INTO guild_settings (guild_id, category_id, support_role_id, log_channel_id, counter, updated_at)
      VALUES (?, ?, ?, ?, 0, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        category_id = excluded.category_id,
        support_role_id = excluded.support_role_id,
        log_channel_id = excluded.log_channel_id,
        updated_at = excluded.updated_at
    `).run(guildId, categoryId, support, logs, now);
    return this.getSettings(guildId)!;
  }

  createPanel(input: CreatePanelInput): Panel {
    const id = randomUUID();
    const createdAt = Date.now();
    this.database.prepare(`
      INSERT INTO panels (
        id, guild_id, channel_id, title, description, button_label,
        welcome_title, welcome_description, image_url, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.guildId,
      input.channelId,
      input.title,
      input.description,
      input.buttonLabel,
      input.welcomeTitle,
      input.welcomeDescription,
      input.imageUrl,
      input.createdBy,
      createdAt
    );
    return this.getPanel(id)!;
  }

  getPanel(id: string): Panel | null {
    const row = this.database.prepare('SELECT * FROM panels WHERE id = ?').get(id) as PanelRow | undefined;
    return row ? mapPanel(row) : null;
  }

  setPanelMessage(id: string, messageId: string): void {
    this.database.prepare('UPDATE panels SET message_id = ? WHERE id = ?').run(messageId, id);
  }

  deactivatePanel(id: string): void {
    this.database.prepare('UPDATE panels SET active = 0 WHERE id = ?').run(id);
  }

  nextTicketNumber(guildId: string): number {
    return this.database.transaction(() => {
      const result = this.database.prepare(`
        UPDATE guild_settings SET counter = counter + 1, updated_at = ? WHERE guild_id = ?
      `).run(Date.now(), guildId);
      if (result.changes !== 1) throw new Error('Configuration introuvable');
      const row = this.database.prepare('SELECT counter FROM guild_settings WHERE guild_id = ?').get(guildId) as { counter: number };
      return row.counter;
    })();
  }

  createTicket(input: CreateTicketInput): Ticket {
    const result = this.database.prepare(`
      INSERT INTO tickets (
        guild_id, channel_id, owner_id, panel_id, number, status, channel_name, created_at
      ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)
    `).run(
      input.guildId,
      input.channelId,
      input.ownerId,
      input.panelId,
      input.number,
      input.channelName,
      Date.now()
    );
    return this.getTicket(Number(result.lastInsertRowid))!;
  }

  getTicket(id: number): Ticket | null {
    const row = this.database.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as TicketRow | undefined;
    return row ? mapTicket(row) : null;
  }

  getTicketByChannel(channelId: string): Ticket | null {
    const row = this.database.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId) as TicketRow | undefined;
    return row ? mapTicket(row) : null;
  }

  findCurrentTicket(guildId: string, ownerId: string): Ticket | null {
    const row = this.database.prepare(`
      SELECT * FROM tickets
      WHERE guild_id = ? AND owner_id = ? AND status IN ('OPEN', 'CLOSED')
      ORDER BY id DESC LIMIT 1
    `).get(guildId, ownerId) as TicketRow | undefined;
    return row ? mapTicket(row) : null;
  }

  setControlMessage(id: number, messageId: string): void {
    this.database.prepare('UPDATE tickets SET control_message_id = ? WHERE id = ?').run(messageId, id);
  }

  setClaimedBy(id: number, userId: string | null): void {
    this.database.prepare("UPDATE tickets SET claimed_by = ? WHERE id = ? AND status = 'OPEN'").run(userId, id);
  }

  setStatus(id: number, status: TicketStatus): void {
    const closedAt = status === 'CLOSED' ? Date.now() : null;
    this.database.prepare('UPDATE tickets SET status = ?, closed_at = ? WHERE id = ?').run(status, closedAt, id);
  }

  setChannelName(id: number, channelName: string): void {
    this.database.prepare('UPDATE tickets SET channel_name = ? WHERE id = ?').run(channelName, id);
  }

  addMember(ticketId: number, userId: string): void {
    this.database.prepare(`
      INSERT INTO ticket_members (ticket_id, user_id, added_at)
      VALUES (?, ?, ?)
      ON CONFLICT(ticket_id, user_id) DO NOTHING
    `).run(ticketId, userId, Date.now());
  }

  removeMember(ticketId: number, userId: string): boolean {
    return this.database.prepare('DELETE FROM ticket_members WHERE ticket_id = ? AND user_id = ?').run(ticketId, userId).changes === 1;
  }

  getMembers(ticketId: number): string[] {
    const rows = this.database.prepare('SELECT user_id FROM ticket_members WHERE ticket_id = ?').all(ticketId) as Array<{ user_id: string }>;
    return rows.map((row) => row.user_id);
  }

  close(): void {
    this.database.close();
  }
}

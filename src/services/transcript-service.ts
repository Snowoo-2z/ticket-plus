import { AttachmentBuilder, Message, TextChannel } from 'discord.js';
import type { Ticket } from '../database/types';
import { padTicketNumber } from '../utils/text';

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatText = (value: string): string => escapeHtml(value).replaceAll('\n', '<br>');

const renderMessage = (message: Message<true>): string => {
  const attachments = [...message.attachments.values()]
    .map((attachment) => `<a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name)}</a>`)
    .join('');
  const embeds = message.embeds
    .map((embed) => {
      const title = embed.title ? `<strong>${formatText(embed.title)}</strong>` : '';
      const description = embed.description ? `<div>${formatText(embed.description)}</div>` : '';
      const fields = embed.fields
        .map((field) => `<div><strong>${formatText(field.name)}</strong><br>${formatText(field.value)}</div>`)
        .join('');
      return `<div class="embed">${title}${description}${fields}</div>`;
    })
    .join('');
  const reply = message.reference?.messageId
    ? `<div class="reply">Réponse au message ${escapeHtml(message.reference.messageId)}</div>`
    : '';
  const edited = message.editedTimestamp ? ' • modifié' : '';

  return `
    <article class="message">
      <img src="${escapeHtml(message.author.displayAvatarURL({ size: 64 }))}" alt="">
      <div class="body">
        <div class="meta">
          <strong>${escapeHtml(message.author.globalName || message.author.username)}</strong>
          <span>${new Date(message.createdTimestamp).toLocaleString('fr-FR')}${edited}</span>
        </div>
        ${reply}
        <div class="content">${formatText(message.cleanContent || '')}</div>
        <div class="attachments">${attachments}</div>
        ${embeds}
      </div>
    </article>
  `;
};

export class TranscriptService {
  async create(channel: TextChannel, ticket: Ticket): Promise<AttachmentBuilder> {
    const messages: Message<true>[] = [];
    let before: string | undefined;

    while (messages.length < 5000) {
      const batch = await channel.messages.fetch({ limit: 100, before });
      if (batch.size === 0) break;
      messages.push(...batch.values());
      before = batch.last()?.id;
      if (batch.size < 100) break;
    }

    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const number = padTicketNumber(ticket.number);
    const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ticket #${number}</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#111214;color:#dbdee1;font-family:Inter,Arial,sans-serif}.header{position:sticky;top:0;padding:24px 32px;background:#1e1f22;border-bottom:1px solid #35363c;z-index:2}.header h1{margin:0 0 8px;font-size:22px}.header p{margin:0;color:#949ba4}.messages{max-width:1000px;margin:auto;padding:24px}.message{display:flex;gap:16px;padding:12px 16px;border-radius:8px}.message:hover{background:#1e1f22}.message img{width:42px;height:42px;border-radius:50%;object-fit:cover}.body{min-width:0;flex:1}.meta{display:flex;align-items:baseline;gap:10px}.meta strong{color:#f2f3f5}.meta span,.reply{font-size:12px;color:#949ba4}.content{margin-top:4px;line-height:1.45;overflow-wrap:anywhere}.attachments{display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin-top:5px}.attachments a{color:#00a8fc}.embed{max-width:620px;margin-top:8px;padding:12px 14px;border-left:4px solid #5865f2;border-radius:4px;background:#2b2d31}.embed div{margin-top:7px}.empty{text-align:center;color:#949ba4;padding:80px 0}</style>
</head>
<body>
<header class="header"><h1>Ticket #${number}</h1><p>${escapeHtml(channel.name)} • ${messages.length} message${messages.length > 1 ? 's' : ''}</p></header>
<main class="messages">${messages.length ? messages.map(renderMessage).join('') : '<div class="empty">Aucun message</div>'}</main>
</body>
</html>`;

    return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
      name: `ticket-${number}.html`
    });
  }
}

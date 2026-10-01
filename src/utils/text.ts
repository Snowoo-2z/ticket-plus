export const padTicketNumber = (number: number): string => number.toString().padStart(4, '0');

export const slugify = (value: string): string => {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'ticket';
};

export const ticketChannelName = (number: number, label: string): string => {
  const prefix = `ticket-${padTicketNumber(number)}-`;
  return `${prefix}${slugify(label).slice(0, 100 - prefix.length)}`;
};

export const closedChannelName = (channelName: string): string =>
  `ferme-${channelName.replace(/^ticket-/, '').slice(0, 94)}`;

export const extractUserId = (value: string): string | null => {
  const match = value.trim().match(/^(?:<@!?)?(\d{17,20})>?$/);
  return match?.[1] ?? null;
};

export const renderTicketText = (
  value: string,
  userId: string,
  channelId: string,
  number: number
): string => value
  .replaceAll('{user}', `<@${userId}>`)
  .replaceAll('{ticket}', `<#${channelId}>`)
  .replaceAll('{number}', padTicketNumber(number));

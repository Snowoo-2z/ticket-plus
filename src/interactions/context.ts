import { Repository } from '../database/repository';
import { TicketService } from '../services/ticket-service';
import { PanelDraftStore } from '../stores/panel-drafts';

export interface BotContext {
  repository: Repository;
  drafts: PanelDraftStore;
  tickets: TicketService;
}

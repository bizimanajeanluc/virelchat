import { format } from 'date-fns';

export interface AuditLog {
  messageId: string;
  senderId: string;
  recipientId: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  detectedIssue?: string;
  accuracyWarning: boolean;
  visibilityAtRead?: string;
}

class MessageAuditService {
  private logs: Map<string, AuditLog> = new Map();
  private issueCount: number = 0;

  trackSent(messageId: string, senderId: string, recipientId: string) {
    this.logs.set(messageId, {
      messageId,
      senderId,
      recipientId,
      sentAt: new Date().toISOString(),
      accuracyWarning: false
    });
    console.log(`[AUDIT] message_sent: ${messageId} from ${senderId} to ${recipientId}`);
  }

  trackDelivered(messageId: string) {
    const log = this.logs.get(messageId);
    if (log) {
      log.deliveredAt = new Date().toISOString();
      console.log(`[AUDIT] message_delivered: ${messageId}`);
    }
  }

  trackRead(messageId: string, isPremature: boolean, visibilityState: string) {
    const log = this.logs.get(messageId);
    if (log) {
      log.readAt = new Date().toISOString();
      log.visibilityAtRead = visibilityState;
      
      if (isPremature) {
        log.accuracyWarning = true;
        log.detectedIssue = `Marked as read while ${visibilityState}`;
        this.issueCount++;
        console.warn(`[AUDIT] PREMATURE READ DETECTED: ${messageId} (State: ${visibilityState})`);
      } else {
        console.log(`[AUDIT] message_read: ${messageId}`);
      }
    }
  }

  getLogs() {
    return Array.from(this.logs.values());
  }

  getIssueCount() {
    return this.issueCount;
  }

  getReport() {
    return {
      totalTracked: this.logs.size,
      issuesFound: this.issueCount,
      accuracyRate: this.logs.size > 0 ? ((this.logs.size - this.issueCount) / this.logs.size * 100).toFixed(2) : '100',
      timestamp: new Date().toISOString()
    };
  }
}

export const auditService = new MessageAuditService();

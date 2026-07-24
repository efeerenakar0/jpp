import fs from 'fs';
import path from 'path';

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'customer' | 'assistant' | 'patron';
  content: string;
  createdAt: string;
  metaStatus?: 'DELIVERED' | 'FAILED' | 'PENDING';
  metaError?: string;
}

export interface StoredConversation {
  id: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail?: string | null;
  channel: string;
  intent: string;
  summary: string | null;
  updatedAt: string;
  createdAt: string;
  messages: StoredMessage[];
  _count?: { messages: number };
}

const globalStore = globalThis as unknown as {
  sharedConversations: StoredConversation[];
  deletedConversationIds: Set<string>;
};

const TMP_CONVERSATIONS_PATH = '/tmp/jasmine_conversations.json';

if (!globalStore.sharedConversations) {
  globalStore.sharedConversations = [];
}

if (!globalStore.deletedConversationIds) {
  globalStore.deletedConversationIds = new Set<string>();
}

export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('05')) clean = `90${clean.substring(1)}`;
  else if (clean.length === 10 && clean.startsWith('5')) clean = `90${clean}`;
  return clean;
}

export function isBannedConversation(c: any): boolean {
  if (!c) return true;
  const id = String(c.id || '').toLowerCase();
  const name = String(c.customerName || '').toLowerCase();
  const phone = normalizePhoneNumber(c.customerPhone);
  return id.includes('demo') || id === 'demo_conv_1' || name.includes('ahmet') || phone === '905321234567';
}

function loadFromFileStore(): StoredConversation[] {
  try {
    if (fs.existsSync(TMP_CONVERSATIONS_PATH)) {
      const raw = fs.readFileSync(TMP_CONVERSATIONS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return deduplicateConversations(parsed.filter(c => !isBannedConversation(c)));
      }
    }
  } catch (e) {}
  return [];
}

function deduplicateConversations(convs: StoredConversation[]): StoredConversation[] {
  const map = new Map<string, StoredConversation>();
  
  convs.forEach(c => {
    const norm = normalizePhoneNumber(c.customerPhone) || c.id;
    const existing = map.get(norm);
    if (existing) {
      const msgMap = new Map<string, StoredMessage>();
      (existing.messages || []).forEach(m => msgMap.set(m.id || `${m.role}_${m.content}`, m));
      (c.messages || []).forEach(m => msgMap.set(m.id || `${m.role}_${m.content}`, m));
      const mergedMsgs = Array.from(msgMap.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      map.set(norm, {
        ...existing,
        summary: c.summary || existing.summary,
        updatedAt: new Date(Math.max(new Date(existing.updatedAt).getTime(), new Date(c.updatedAt).getTime())).toISOString(),
        messages: mergedMsgs,
        _count: { messages: mergedMsgs.length }
      });
    } else {
      map.set(norm, c);
    }
  });

  return Array.from(map.values());
}

function saveToFileStore(convs: StoredConversation[]) {
  try {
    const cleaned = deduplicateConversations(convs.filter(c => !isBannedConversation(c)));
    fs.writeFileSync(TMP_CONVERSATIONS_PATH, JSON.stringify(cleaned));
  } catch (e) {}
}

export function getConversationsStore(): StoredConversation[] {
  if (!globalStore.sharedConversations || globalStore.sharedConversations.length === 0) {
    const fromFile = loadFromFileStore();
    if (fromFile.length > 0) {
      globalStore.sharedConversations = fromFile;
    }
  }

  // Deduplicate and purge banned items
  globalStore.sharedConversations = deduplicateConversations(globalStore.sharedConversations.filter(c => !isBannedConversation(c)));

  return globalStore.sharedConversations.filter(c => !globalStore.deletedConversationIds.has(c.id));
}

export function deleteConversationFromStore(id: string) {
  globalStore.deletedConversationIds.add(id);
  globalStore.sharedConversations = globalStore.sharedConversations.filter(c => c.id !== id);
  saveToFileStore(globalStore.sharedConversations);
}

export function addIncomingCustomerMessage(fromPhone: string, textBody: string, contactName?: string): StoredConversation {
  const normPhone = normalizePhoneNumber(fromPhone);
  
  getConversationsStore();

  let conv = globalStore.sharedConversations.find(c => normalizePhoneNumber(c.customerPhone) === normPhone);

  const customerMsg: StoredMessage = {
    id: `msg_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId: conv ? conv.id : `conv_${Date.now()}`,
    role: 'customer',
    content: textBody,
    createdAt: new Date().toISOString()
  };

  if (conv) {
    conv.summary = textBody;
    conv.updatedAt = new Date().toISOString();
    conv.messages.push(customerMsg);
    conv._count = { messages: conv.messages.length };
  } else {
    conv = {
      id: `conv_${Date.now()}`,
      customerName: contactName || fromPhone,
      customerPhone: normPhone || fromPhone,
      channel: 'WHATSAPP',
      intent: 'INVESTMENT',
      summary: textBody,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      messages: [customerMsg],
      _count: { messages: 1 }
    };
    globalStore.sharedConversations.unshift(conv);
  }

  saveToFileStore(globalStore.sharedConversations);
  return conv;
}

export function addAssistantMessageToStore(conversationId: string, replyText: string, metadata?: { sentViaMeta?: boolean; metaStatus?: 'DELIVERED' | 'FAILED' | 'PENDING'; metaError?: string }): StoredMessage {
  getConversationsStore();

  const assistantMsg: StoredMessage = {
    id: `msg_asst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId,
    role: 'assistant',
    content: replyText,
    createdAt: new Date().toISOString(),
    metaStatus: metadata?.metaStatus || 'DELIVERED',
    metaError: metadata?.metaError
  };

  const conv = globalStore.sharedConversations.find(c => c.id === conversationId);
  if (conv) {
    conv.updatedAt = new Date().toISOString();
    conv.messages.push(assistantMsg);
    conv._count = { messages: conv.messages.length };
  }

  saveToFileStore(globalStore.sharedConversations);
  return assistantMsg;
}

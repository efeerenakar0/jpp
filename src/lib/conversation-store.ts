import fs from 'fs';
import path from 'path';

export interface StoredMessage {
  id: string;
  conversationId: string;
  role: 'customer' | 'assistant' | 'patron';
  content: string;
  createdAt: string;
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

function loadFromFileStore(): StoredConversation[] {
  try {
    if (fs.existsSync(TMP_CONVERSATIONS_PATH)) {
      const raw = fs.readFileSync(TMP_CONVERSATIONS_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(c => c.id !== 'demo_conv_1' && !c.customerName?.toLowerCase().includes('ahmet'));
      }
    }
  } catch (e) {}
  return [];
}

function saveToFileStore(convs: StoredConversation[]) {
  try {
    const cleaned = convs.filter(c => c.id !== 'demo_conv_1' && !c.customerName?.toLowerCase().includes('ahmet'));
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

  return globalStore.sharedConversations.filter(c => 
    c.id !== 'demo_conv_1' && 
    !c.customerName?.toLowerCase().includes('ahmet') && 
    !globalStore.deletedConversationIds.has(c.id)
  );
}

export function deleteConversationFromStore(id: string) {
  globalStore.deletedConversationIds.add(id);
  globalStore.sharedConversations = globalStore.sharedConversations.filter(c => c.id !== id);
  saveToFileStore(globalStore.sharedConversations);
}

export function addIncomingCustomerMessage(fromPhone: string, textBody: string, contactName?: string): StoredConversation {
  let cleanPhone = fromPhone.replace(/[^0-9]/g, '');
  
  // Ensure disk store is loaded first
  getConversationsStore();

  let conv = globalStore.sharedConversations.find(c => c.customerPhone && c.customerPhone.replace(/[^0-9]/g, '') === cleanPhone);

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
      customerPhone: fromPhone,
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

export function addAssistantMessageToStore(conversationId: string, replyText: string): StoredMessage {
  getConversationsStore();

  const assistantMsg: StoredMessage = {
    id: `msg_asst_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId,
    role: 'assistant',
    content: replyText,
    createdAt: new Date().toISOString()
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

export type CrmMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'VIEWER';
  active: boolean;
};

export type CrmContact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: 'BUYER' | 'SELLER' | 'INVESTOR' | 'TENANT' | 'OTHER';
  stage: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'VIEWING' | 'OFFER' | 'WON' | 'LOST';
  source: string | null;
  desiredLocation: string | null;
  desiredRoomCount: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  notes: string | null;
  tags: string[];
  score: number;
  scoreReasons: string[];
  scoreSource: 'AI' | 'RULES' | null;
  scoreUpdatedAt: string | null;
  consentStatus: 'UNKNOWN' | 'GRANTED' | 'REVOKED';
  nextActionAt: string | null;
  assignedMemberId?: string | null;
  assignedMember: Pick<CrmMember, 'id' | 'name'> | null;
  duplicateContactIds?: string[];
  createdAt?: string;
  updatedAt: string;
};

export type CrmProperty = {
  id: string;
  title: string;
  referenceCode: string | null;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'ARCHIVED';
  description: string | null;
  imageUrl: string | null;
  ownerContact: Pick<CrmContact, 'id' | 'name'> | null;
  assignedMember: Pick<CrmMember, 'id' | 'name'> | null;
};

export type CrmDealStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'MATCHED'
  | 'VIEWING'
  | 'OFFER'
  | 'CONTRACT'
  | 'WON'
  | 'LOST';

export type CrmDeal = {
  id: string;
  title: string;
  stage: CrmDealStage;
  estimatedValue: number | null;
  commissionRate: number | null;
  probability: number;
  nextAction: string | null;
  contact: Pick<CrmContact, 'id' | 'name' | 'phone'>;
  property: Pick<CrmProperty, 'id' | 'title' | 'location'> | null;
  assignedMember: Pick<CrmMember, 'id' | 'name'> | null;
};

export type CrmTask = {
  id: string;
  title: string;
  type: 'CALL' | 'MESSAGE' | 'MEETING' | 'VIEWING' | 'FOLLOW_UP' | 'DOCUMENT' | 'OTHER';
  description: string | null;
  dueAt: string | null;
  priority: number;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  contact: Pick<CrmContact, 'id' | 'name'> | null;
  property: Pick<CrmProperty, 'id' | 'title'> | null;
  deal: Pick<CrmDeal, 'id' | 'title'> | null;
  assignedMember: Pick<CrmMember, 'id' | 'name'> | null;
};

export type CrmActivity = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  metadata: string | null;
  contact: Pick<CrmContact, 'id' | 'name'> | null;
  property: Pick<CrmProperty, 'id' | 'title'> | null;
  deal: Pick<CrmDeal, 'id' | 'title'> | null;
  actorMember: Pick<CrmMember, 'id' | 'name'> | null;
  createdAt: string;
};

export type CrmMatch = {
  id: string;
  score: number;
  status: string;
  reasons: string[];
  contact: Pick<CrmContact, 'id' | 'name' | 'phone' | 'desiredLocation' | 'desiredRoomCount'>;
  property: Pick<CrmProperty, 'id' | 'title' | 'location' | 'price' | 'roomCount' | 'imageUrl'>;
};

export type CrmWorkspaceData = {
  account: {
    id: string;
    companyName: string;
    ownerName: string;
  };
  permissions: {
    canManageTeam: boolean;
    canManageSecrets: boolean;
    canViewSubscription: boolean;
    canEditReports: boolean;
  };
  members: CrmMember[];
  contacts: CrmContact[];
  properties: CrmProperty[];
  deals: CrmDeal[];
  tasks: CrmTask[];
  activities: CrmActivity[];
  matches: CrmMatch[];
  metrics: {
    contacts: number;
    activeProperties: number;
    openDeals: number;
    overdueTasks: number;
    upcomingCriticalTasks: number;
    pipelineValue: number;
    wonCommission: number;
    averageMatchScore: number;
  };
};

export type FinanceEntryKind =
  | 'DEBIT'
  | 'PAYMENT'
  | 'DEPOSIT'
  | 'COMMISSION'
  | 'EXPENSE'
  | 'REFUND';

export type FinanceEntryStatus = 'PLANNED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export type FinanceEntry = {
  activityId: string;
  contactId: string;
  contactName: string;
  dealId: string | null;
  propertyId: string | null;
  kind: FinanceEntryKind;
  status: FinanceEntryStatus;
  amount: number;
  currency: 'TRY' | 'USD' | 'EUR' | 'GBP';
  occurredAt: string;
  dueAt: string | null;
  method: string | null;
  reference: string | null;
  description: string | null;
  reversed: boolean;
  createdAt: string;
};

export type CrmSection =
  | 'overview'
  | 'customers'
  | 'pipeline'
  | 'tasks'
  | 'finance'
  | 'insights';

export type ContactDetailTab =
  | 'summary'
  | 'requirements'
  | 'activity'
  | 'finance'
  | 'tasks'
  | 'deals';

// User types
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'REGISTRATOR' | 'ACCOUNTANT' | 'STATISTICIAN';
  city?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Event types
export interface Event {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  description?: string;
  image?: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isOnline: boolean;
  paymentEnable: boolean;
  categoryEnable: boolean;
  songEnable: boolean;
  durationMax: number;
  durationGroupsInterval: number;
  durationParticipantsInterval: number;
  pricePerDiploma?: number;
  pricePerMedal?: number;
  discountTiers?: string; // JSON string
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscountTier {
  minAmount: number;
  maxAmount: number;
  percentage: number;
}

// Registration types
export interface Registration {
  id: number;
  userId: number;
  eventId: number;
  collectiveId: number;
  disciplineId: number;
  nominationId: number;
  ageId: number;
  categoryId?: number;
  danceName?: string;
  duration?: string;
  participantsCount: number;
  federationParticipantsCount: number;
  diplomasCount: number;
  medalsCount: number;
  diplomasList?: string;
  paymentStatus: 'UNPAID' | 'PERFORMANCE_PAID' | 'DIPLOMAS_PAID' | 'PAID';
  paidAmount?: number;
  performancePaid: boolean;
  diplomasAndMedalsPaid: boolean;
  diplomasPaid: boolean;
  medalsPaid: boolean;
  diplomasPrinted: boolean;
  diplomasDataDeletedAt?: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  resume?: string;
  number?: number;
  blockNumber?: number;
  performedAt?: Date;
  placeId?: number;
  videoUrl?: string;
  songUrl?: string;
  agreement: boolean;
  agreement2: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Accounting types
export interface AccountingEntry {
  id: number;
  registrationId: number;
  collectiveId: number;
  amount: number;
  discountAmount: number;
  discountPercent: number;
  method: 'CASH' | 'CARD' | 'TRANSFER';
  paidFor: 'PERFORMANCE' | 'DIPLOMAS_MEDALS';
  paymentGroupId?: string;
  paymentGroupName?: string;
  deletedAt?: Date;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  errors?: Array<{ msg: string; param: string; location?: string }>;
}



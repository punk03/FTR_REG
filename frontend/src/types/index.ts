export type UserRole = 'ADMIN' | 'REGISTRATOR' | 'ACCOUNTANT' | 'STATISTICIAN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  city?: string;
  phone?: string;
  createdAt?: string;
}

export interface Event {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  description?: string;
  image?: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  isOnline: boolean;
  paymentEnable: boolean;
  categoryEnable: boolean;
  songEnable: boolean;
  durationMax: number;
  pricePerDiploma?: number;
  pricePerMedal?: number;
  discountTiers?: string;
  calculatorToken?: string;
}

export interface Registration {
  id: number;
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  number?: number;
  blockNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  errors?: Array<{ msg: string; param: string; location?: string }>;
}


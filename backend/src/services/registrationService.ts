import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ParseParticipantsResult {
  participants: string[];
  count: number;
}

/**
 * Parse participants list from text
 * Removes numbering (1., 2), 1, 2. etc.) and extra punctuation
 */
export const parseParticipants = (text: string): ParseParticipantsResult => {
  if (!text || !text.trim()) {
    return { participants: [], count: 0 };
  }

  // Remove numbering patterns: 1., 2), 1, 2. etc.
  let cleaned = text.replace(/^\d+[\.\)]\s*/gm, ''); // Remove "1. ", "2) " at start of line
  cleaned = cleaned.replace(/^\d+\s+/gm, ''); // Remove "1 ", "2 " at start of line

  // Split by newlines
  const lines = cleaned.split('\n');

  // Process each line
  const participants = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => {
      // Filter out lines that are just numbers or punctuation
      return !/^[\d\s\.,;:]+$/.test(line);
    });

  return {
    participants,
    count: participants.length,
  };
};

/**
 * Validate nomination participant count
 */
export const validateNominationParticipants = (
  nominationName: string,
  participantsCount: number,
  participantIds?: number[]
): { valid: boolean; error?: string } => {
  const name = nominationName.toLowerCase();

  if (name.includes('соло')) {
    if (participantsCount !== 1) {
      return { valid: false, error: 'Соло требует ровно 1 участника' };
    }
    if (!participantIds || participantIds.length !== 1) {
      return { valid: false, error: 'Для соло требуется указать участника' };
    }
  } else if (name.includes('дуэт') || name.includes('пара')) {
    if (participantsCount !== 2) {
      return { valid: false, error: 'Дуэт/Пара требует ровно 2 участников' };
    }
    if (!participantIds || participantIds.length !== 2) {
      return { valid: false, error: 'Для дуэта/пары требуется указать 2 участников' };
    }
  } else if (name.includes('трио')) {
    if (participantsCount !== 3) {
      return { valid: false, error: 'Трио требует ровно 3 участников' };
    }
  } else if (name.includes('квартет')) {
    if (participantsCount !== 4) {
      return { valid: false, error: 'Квартет требует ровно 4 участников' };
    }
  } else if (name.includes('малая группа')) {
    if (participantsCount < 3 || participantsCount > 7) {
      return { valid: false, error: 'Малая группа требует от 3 до 7 участников' };
    }
  } else if (name.includes('формейшн')) {
    if (participantsCount < 8 || participantsCount > 24) {
      return { valid: false, error: 'Формейшн требует от 8 до 24 участников' };
    }
  } else if (name.includes('продакшн')) {
    if (participantsCount < 25) {
      return { valid: false, error: 'Продакшн требует минимум 25 участников' };
    }
  }

  return { valid: true };
};

/**
 * Upsert collective (merge duplicates)
 */
export const upsertCollective = async (name: string, accessory?: string) => {
  // Try to find existing collective by name (case-insensitive)
  const existing = await prisma.collective.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });

  if (existing) {
    // Update accessory if provided and different
    if (accessory && accessory !== existing.accessory) {
      return await prisma.collective.update({
        where: { id: existing.id },
        data: { accessory },
      });
    }
    return existing;
  }

  // Create new collective
  return await prisma.collective.create({
    data: {
      name,
      accessory,
    },
  });
};

/**
 * Upsert person (merge duplicates by fullName + role)
 */
export const upsertPerson = async (
  fullName: string,
  role: 'LEADER' | 'TRAINER',
  phone?: string
) => {
  const existing = await prisma.person.findUnique({
    where: {
      fullName_role: {
        fullName,
        role,
      },
    },
  });

  if (existing) {
    // Update phone if provided and different
    if (phone && phone !== existing.phone) {
      return await prisma.person.update({
        where: { id: existing.id },
        data: { phone },
      });
    }
    return existing;
  }

  return await prisma.person.create({
    data: {
      fullName,
      role,
      phone,
    },
  });
};

/**
 * Get next registration number for event
 */
export const getNextRegistrationNumber = async (eventId: number): Promise<number> => {
  const lastRegistration = await prisma.registration.findFirst({
    where: { eventId },
    orderBy: { number: 'desc' },
  });

  return lastRegistration && lastRegistration.number ? lastRegistration.number + 1 : 1;
};



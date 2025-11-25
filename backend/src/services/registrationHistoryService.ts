import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RegistrationHistoryData {
  registrationId: number;
  userId: number;
  action: string;
  changedFields?: string[];
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
}

export const createRegistrationHistory = async (
  data: RegistrationHistoryData
): Promise<void> => {
  try {
    await prisma.registrationHistory.create({
      data: {
        registrationId: data.registrationId,
        userId: data.userId,
        action: data.action,
        changedFields: data.changedFields ? JSON.stringify(data.changedFields) : null,
        oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
        newValues: data.newValues ? JSON.stringify(data.newValues) : null,
        ipAddress: data.ipAddress,
      },
    });
  } catch (error) {
    console.error('Error creating registration history:', error);
    // Don't throw - history logging should not break the main flow
  }
};

export const getChangedFields = (
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): { changedFields: string[]; oldValues: Record<string, unknown>; newValues: Record<string, unknown> } => {
  const changedFields: string[] = [];
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  // Compare all fields
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  for (const key of allKeys) {
    const oldValue = oldData[key];
    const newValue = newData[key];

    // Skip timestamps and internal fields
    if (key === 'createdAt' || key === 'updatedAt' || key === 'id') {
      continue;
    }

    // Compare values (deep comparison for objects)
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedFields.push(key);
      oldValues[key] = oldValue;
      newValues[key] = newValue;
    }
  }

  return { changedFields, oldValues, newValues };
};


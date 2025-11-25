import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuditLogData {
  action: string;
  entityType?: string;
  entityId?: number;
  oldValue?: unknown;
  newValue?: unknown;
}

export const auditLog = async (
  req: Request,
  action: string,
  data?: AuditLogData
): Promise<void> => {
  try {
    if (!req.user) {
      return;
    }

    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: data?.action || action,
        entityType: data?.entityType,
        entityId: data?.entityId,
        oldValue: data?.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data?.newValue ? JSON.stringify(data.newValue) : null,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
      },
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw - audit logging should not break the main flow
  }
};

export const auditLogMiddleware = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to capture response
    res.json = function (body: unknown) {
      // Log after response is sent
      setImmediate(() => {
        auditLog(req, action, {
          action,
          entityType: req.params.entityType,
          entityId: req.params.id ? parseInt(req.params.id) : undefined,
          newValue: body,
        });
      });

      return originalJson(body);
    };

    next();
  };
};



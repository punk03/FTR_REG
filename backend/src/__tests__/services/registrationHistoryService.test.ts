import { getChangedFields } from '../../services/registrationHistoryService';

describe('RegistrationHistoryService', () => {
  describe('getChangedFields', () => {
    it('should detect changed fields', () => {
      const oldData = {
        id: 1,
        collectiveName: 'Old Name',
        danceName: 'Old Dance',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      
      const newData = {
        id: 1,
        collectiveName: 'New Name',
        danceName: 'Old Dance',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      };
      
      const result = getChangedFields(oldData, newData);
      
      expect(result.changedFields).toContain('collectiveName');
      expect(result.changedFields).not.toContain('danceName');
      expect(result.changedFields).not.toContain('id');
      expect(result.changedFields).not.toContain('createdAt');
      expect(result.changedFields).not.toContain('updatedAt');
      expect(result.oldValues.collectiveName).toBe('Old Name');
      expect(result.newValues.collectiveName).toBe('New Name');
    });

    it('should detect multiple changed fields', () => {
      const oldData = {
        id: 1,
        collectiveName: 'Old Name',
        danceName: 'Old Dance',
        participantsCount: 5,
      };
      
      const newData = {
        id: 1,
        collectiveName: 'New Name',
        danceName: 'New Dance',
        participantsCount: 10,
      };
      
      const result = getChangedFields(oldData, newData);
      
      expect(result.changedFields.length).toBe(3);
      expect(result.changedFields).toContain('collectiveName');
      expect(result.changedFields).toContain('danceName');
      expect(result.changedFields).toContain('participantsCount');
    });

    it('should detect new fields', () => {
      const oldData = {
        id: 1,
        collectiveName: 'Old Name',
      };
      
      const newData = {
        id: 1,
        collectiveName: 'Old Name',
        danceName: 'New Dance',
      };
      
      const result = getChangedFields(oldData, newData);
      
      expect(result.changedFields).toContain('danceName');
      expect(result.oldValues.danceName).toBeUndefined();
      expect(result.newValues.danceName).toBe('New Dance');
    });

    it('should detect removed fields', () => {
      const oldData = {
        id: 1,
        collectiveName: 'Old Name',
        danceName: 'Old Dance',
      };
      
      const newData = {
        id: 1,
        collectiveName: 'Old Name',
      };
      
      const result = getChangedFields(oldData, newData);
      
      expect(result.changedFields).toContain('danceName');
      expect(result.oldValues.danceName).toBe('Old Dance');
      expect(result.newValues.danceName).toBeUndefined();
    });

    it('should ignore id, createdAt, updatedAt fields', () => {
      const oldData = {
        id: 1,
        collectiveName: 'Name',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      
      const newData = {
        id: 2,
        collectiveName: 'Name',
        createdAt: '2024-01-02',
        updatedAt: '2024-01-02',
      };
      
      const result = getChangedFields(oldData, newData);
      
      expect(result.changedFields).not.toContain('id');
      expect(result.changedFields).not.toContain('createdAt');
      expect(result.changedFields).not.toContain('updatedAt');
    });

    it('should handle empty objects', () => {
      const result = getChangedFields({}, {});
      expect(result.changedFields).toEqual([]);
      expect(Object.keys(result.oldValues)).toHaveLength(0);
      expect(Object.keys(result.newValues)).toHaveLength(0);
    });

    it('should handle nested objects correctly', () => {
      const oldData = {
        id: 1,
        metadata: { key: 'value1' },
      };
      
      const newData = {
        id: 1,
        metadata: { key: 'value2' },
      };
      
      const result = getChangedFields(oldData, newData);
      
      expect(result.changedFields).toContain('metadata');
      expect(result.oldValues.metadata).toEqual({ key: 'value1' });
      expect(result.newValues.metadata).toEqual({ key: 'value2' });
    });
  });
});


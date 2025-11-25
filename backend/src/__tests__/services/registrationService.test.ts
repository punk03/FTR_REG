import { parseParticipants, validateNominationParticipants } from '../../services/registrationService';

describe('RegistrationService', () => {
  describe('parseParticipants', () => {
    it('should parse simple list of participants', () => {
      const text = 'Иванов Иван\nПетров Петр\nСидоров Сидор';
      const result = parseParticipants(text);
      
      expect(result.count).toBe(3);
      expect(result.participants).toEqual(['Иванов Иван', 'Петров Петр', 'Сидоров Сидор']);
    });

    it('should remove numbering patterns', () => {
      const text = '1. Иванов Иван\n2. Петров Петр\n3. Сидоров Сидор';
      const result = parseParticipants(text);
      
      expect(result.count).toBe(3);
      expect(result.participants).toEqual(['Иванов Иван', 'Петров Петр', 'Сидоров Сидор']);
    });

    it('should handle numbered list with parentheses', () => {
      const text = '1) Иванов Иван\n2) Петров Петр';
      const result = parseParticipants(text);
      
      expect(result.count).toBe(2);
      expect(result.participants).toEqual(['Иванов Иван', 'Петров Петр']);
    });

    it('should handle empty text', () => {
      const result = parseParticipants('');
      expect(result.count).toBe(0);
      expect(result.participants).toEqual([]);
    });

    it('should filter out lines with only numbers', () => {
      const text = '1. Иванов Иван\n2. 123\n3. Петров Петр';
      const result = parseParticipants(text);
      
      expect(result.count).toBe(2);
      expect(result.participants).toEqual(['Иванов Иван', 'Петров Петр']);
    });

    it('should trim whitespace', () => {
      const text = '  Иванов Иван  \n  Петров Петр  ';
      const result = parseParticipants(text);
      
      expect(result.count).toBe(2);
      expect(result.participants).toEqual(['Иванов Иван', 'Петров Петр']);
    });
  });

  describe('validateNominationParticipants', () => {
    it('should validate solo nomination correctly', () => {
      const result = validateNominationParticipants('Соло', 1, [1]);
      expect(result.valid).toBe(true);
    });

    it('should reject solo with wrong count', () => {
      const result = validateNominationParticipants('Соло', 2, [1, 2]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Соло требует ровно 1 участника');
    });

    it('should validate duet nomination correctly', () => {
      const result = validateNominationParticipants('Дуэт', 2, [1, 2]);
      expect(result.valid).toBe(true);
    });

    it('should reject duet with wrong count', () => {
      const result = validateNominationParticipants('Дуэт', 3, [1, 2, 3]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Дуэт/Пара требует ровно 2 участников');
    });

    it('should validate trio nomination correctly', () => {
      const result = validateNominationParticipants('Трио', 3);
      expect(result.valid).toBe(true);
    });

    it('should validate quartet nomination correctly', () => {
      const result = validateNominationParticipants('Квартет', 4);
      expect(result.valid).toBe(true);
    });

    it('should validate small group nomination correctly', () => {
      const result = validateNominationParticipants('Малая группа', 5);
      expect(result.valid).toBe(true);
    });

    it('should reject small group with too few participants', () => {
      const result = validateNominationParticipants('Малая группа', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Малая группа требует от 3 до 7 участников');
    });

    it('should reject small group with too many participants', () => {
      const result = validateNominationParticipants('Малая группа', 8);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Малая группа требует от 3 до 7 участников');
    });

    it('should validate formation nomination correctly', () => {
      const result = validateNominationParticipants('Формейшн', 12);
      expect(result.valid).toBe(true);
    });

    it('should reject formation with too few participants', () => {
      const result = validateNominationParticipants('Формейшн', 7);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Формейшн требует от 8 до 24 участников');
    });

    it('should validate production nomination correctly', () => {
      const result = validateNominationParticipants('Продакшн', 25);
      expect(result.valid).toBe(true);
    });

    it('should reject production with too few participants', () => {
      const result = validateNominationParticipants('Продакшн', 24);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Продакшн требует минимум 25 участников');
    });
  });
});


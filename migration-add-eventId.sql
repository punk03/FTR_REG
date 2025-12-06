-- Manual migration to add eventId and description columns to accounting_entries table
-- Run this if Prisma migrate doesn't work

-- Add eventId column (nullable)
ALTER TABLE "AccountingEntry" 
ADD COLUMN IF NOT EXISTS "eventId" INTEGER;

-- Add description column (nullable)
ALTER TABLE "AccountingEntry" 
ADD COLUMN IF NOT EXISTS "description" TEXT;

-- Make registrationId and collectiveId nullable (if not already)
DO $$
BEGIN
  -- Check if column is NOT NULL and make it nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'AccountingEntry' 
    AND column_name = 'registrationId' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "AccountingEntry" ALTER COLUMN "registrationId" DROP NOT NULL;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'AccountingEntry' 
    AND column_name = 'collectiveId' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "AccountingEntry" ALTER COLUMN "collectiveId" DROP NOT NULL;
  END IF;
END $$;

-- Add foreign key constraint for eventId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'AccountingEntry_eventId_fkey'
  ) THEN
    ALTER TABLE "AccountingEntry" 
    ADD CONSTRAINT "AccountingEntry_eventId_fkey" 
    FOREIGN KEY ("eventId") 
    REFERENCES "Event"("id") 
    ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for eventId
CREATE INDEX IF NOT EXISTS "AccountingEntry_eventId_idx" ON "AccountingEntry"("eventId");


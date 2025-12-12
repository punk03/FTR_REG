-- Применение миграции для добавления полей abbreviations и variants в таблицу disciplines
-- Выполните этот SQL скрипт в базе данных, если миграция не была применена автоматически

ALTER TABLE "disciplines" 
ADD COLUMN IF NOT EXISTS "abbreviations" TEXT,
ADD COLUMN IF NOT EXISTS "variants" TEXT;


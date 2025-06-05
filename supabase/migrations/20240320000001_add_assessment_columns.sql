-- Add new columns to assessment_sessions table
ALTER TABLE assessment_sessions
ADD COLUMN IF NOT EXISTS pre_sample_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pre_sample_progress JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS questions_asked INTEGER DEFAULT 0;

-- Update existing records to have default values
UPDATE assessment_sessions
SET 
    pre_sample_completed = FALSE,
    pre_sample_progress = '[]',
    questions_asked = 0
WHERE pre_sample_completed IS NULL;

-- Make chapter_id NOT NULL after setting default values
ALTER TABLE assessment_sessions
ALTER COLUMN chapter_id SET NOT NULL; 
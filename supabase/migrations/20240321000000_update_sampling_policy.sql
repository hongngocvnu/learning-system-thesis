-- First, create a new enum type with the additional value
CREATE TYPE sampling_policy_new AS ENUM ('Thompson', 'HDoC', 'Random', 'Thompson Sampling');

-- Update the column to use the new enum type
ALTER TABLE assessment_sessions 
  ALTER COLUMN sampling_policy TYPE sampling_policy_new 
  USING sampling_policy::text::sampling_policy_new;

-- Drop the old enum type
DROP TYPE sampling_policy;

-- Rename the new enum type to the original name
ALTER TYPE sampling_policy_new RENAME TO sampling_policy; 
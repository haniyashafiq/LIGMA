-- Remove intent column and make source_node_id nullable
ALTER TABLE tasks DROP COLUMN IF EXISTS intent;
ALTER TABLE tasks ALTER COLUMN source_node_id DROP NOT NULL;

-- Update status check constraint to include 'doing'
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'doing', 'done', 'in_progress'));

-- Migrate 'in_progress' to 'doing' for consistency
UPDATE tasks SET status = 'doing' WHERE status = 'in_progress';

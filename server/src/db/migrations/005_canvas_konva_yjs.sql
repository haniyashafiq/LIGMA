-- Canvas domain metadata used by the React Konva + Yjs refactor.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS intent VARCHAR(30),
  ADD COLUMN IF NOT EXISTS source_author_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS source_author_name TEXT;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_intent_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_intent_check
  CHECK (intent IS NULL OR intent IN ('action_item', 'decision', 'open_question', 'reference'));

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_source_node
  ON tasks (workspace_id, source_node_id);

CREATE INDEX IF NOT EXISTS idx_canvas_events_workspace_node
  ON canvas_events (workspace_id, node_id);

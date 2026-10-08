-- Removes the legacy Transaction (Approval) and Verification (Ongoing Process) menus together with the access rows that point at them. Safe to re-run.
-- One statement per line on purpose: some SQL clients split scripts by line or by blank line.
DELETE FROM core_role_menu WHERE menu_new_id IN (SELECT new_id FROM core_menu WHERE path IN ('/transaction/approval', '/verification/ongoing-process') OR (name IN ('Transaction', 'Verification') AND parent_id IS NULL));
DELETE FROM core_menu_function WHERE menu_new_id IN (SELECT new_id FROM core_menu WHERE path IN ('/transaction/approval', '/verification/ongoing-process') OR (name IN ('Transaction', 'Verification') AND parent_id IS NULL));
DELETE FROM core_menu WHERE path IN ('/transaction/approval', '/verification/ongoing-process');
DELETE FROM core_menu WHERE name IN ('Transaction', 'Verification') AND parent_id IS NULL AND NOT EXISTS (SELECT 1 FROM core_menu c WHERE c.parent_id = core_menu.new_id);

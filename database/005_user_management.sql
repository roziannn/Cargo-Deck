-- User management: case-insensitive uniqueness for login names, plus the Settings > User menu.
-- Login matches username/email without regard to case, so two users that differ only in case would be ambiguous.
-- Safe to re-run. Fails (on purpose) if existing users already collide ignoring case: fix those rows first.
CREATE UNIQUE INDEX IF NOT EXISTS ux_core_user_username_ci ON core_user (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS ux_core_user_email_ci ON core_user (lower(email));

INSERT INTO core_menu (name, parent_id, seq, path, created_by)
SELECT 'User', p.new_id, 4, '/settings/user', 'seed'
FROM core_menu p
WHERE p.name = 'Settings' AND p.parent_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM core_menu WHERE path = '/settings/user');

INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn, created_by)
SELECT r.new_id, m.new_id, NULL, true, false, 'seed'
FROM core_role r CROSS JOIN core_menu m
WHERE r.name = 'Administrator'
ON CONFLICT (role_new_id, menu_new_id) WHERE function_new_id IS NULL DO NOTHING;

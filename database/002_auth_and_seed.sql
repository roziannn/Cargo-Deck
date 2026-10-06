-- Login users + initial data (admin role, admin user, base menus). Safe to re-run.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS core_user (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      varchar(100) NOT NULL UNIQUE,
    email         varchar(256) NOT NULL UNIQUE,   -- used as user_principal_name in core_role_claim
    name          varchar(200) NOT NULL,
    site          varchar(50),
    password_hash text         NOT NULL,          -- crypt(password, gen_salt('bf'))
    is_active     boolean      NOT NULL DEFAULT true,
    created_by    varchar(100),
    created_date  timestamptz  NOT NULL DEFAULT now(),
    updated_by    varchar(100),
    updated_date  timestamptz
);

INSERT INTO core_role (name, is_active, created_by)
VALUES ('Administrator', true, 'seed')
ON CONFLICT (name) DO NOTHING;

-- Default login: admin / Admin123!  -> CHANGE THIS PASSWORD after the first login:
--   UPDATE core_user SET password_hash = crypt('<new password>', gen_salt('bf')) WHERE username = 'admin';
INSERT INTO core_user (username, email, name, password_hash, created_by)
VALUES ('admin', 'admin@cargodeck.local', 'Administrator', crypt('Admin123!', gen_salt('bf')), 'seed')
ON CONFLICT (username) DO NOTHING;

INSERT INTO core_role_claim (role_id, user_principal_name, employee_name, created_by)
SELECT r.new_id, u.email, u.name, 'seed'
FROM core_role r, core_user u
WHERE r.name = 'Administrator' AND u.username = 'admin'
ON CONFLICT (role_id, user_principal_name) DO NOTHING;

DO $$
DECLARE
    m_master uuid; m_shipping uuid; m_trx uuid; m_verif uuid; m_settings uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM core_menu) THEN RETURN; END IF;  -- seed menus only once

    INSERT INTO core_menu (name, seq, icon, path, created_by) VALUES ('Dashboard', 1, 'dashboard', '/dashboard', 'seed');
    INSERT INTO core_menu (name, seq, icon, created_by) VALUES ('Master', 2, 'master', 'seed') RETURNING new_id INTO m_master;
    INSERT INTO core_menu (name, seq, icon, created_by) VALUES ('Shipping', 3, 'database', 'seed') RETURNING new_id INTO m_shipping;
    INSERT INTO core_menu (name, seq, icon, created_by) VALUES ('Transaction', 4, 'reports', 'seed') RETURNING new_id INTO m_trx;
    INSERT INTO core_menu (name, seq, icon, created_by) VALUES ('Verification', 5, 'audit', 'seed') RETURNING new_id INTO m_verif;
    INSERT INTO core_menu (name, seq, icon, path, created_by) VALUES ('Audit Trail', 6, 'audit', '/audit-trail', 'seed');
    INSERT INTO core_menu (name, seq, icon, created_by) VALUES ('Settings', 7, 'settings', 'seed') RETURNING new_id INTO m_settings;

    INSERT INTO core_menu (name, parent_id, seq, path, created_by) VALUES
        ('Vehicle',         m_master,   1, '/master/vehicle', 'seed'),
        ('Cubstool',        m_master,   2, '/master/cubstool', 'seed'),
        ('Container Load',  m_shipping, 1, '/shipping/container-load', 'seed'),
        ('Approval',        m_trx,      1, '/transaction/approval', 'seed'),
        ('Ongoing Process', m_verif,    1, '/verification/ongoing-process', 'seed'),
        ('Role',            m_settings, 1, '/settings/role', 'seed'),
        ('Menu',            m_settings, 2, '/settings/menu', 'seed'),
        ('Account',         m_settings, 3, '/settings/account', 'seed');
END $$;

-- Administrator gets access to every menu that has no grant yet.
INSERT INTO core_role_menu (role_new_id, menu_new_id, function_new_id, is_active, is_active_btn, created_by)
SELECT r.new_id, m.new_id, NULL, true, false, 'seed'
FROM core_role r CROSS JOIN core_menu m
WHERE r.name = 'Administrator'
ON CONFLICT (role_new_id, menu_new_id) WHERE function_new_id IS NULL DO NOTHING;

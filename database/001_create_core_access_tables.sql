-- Core access-control tables (PostgreSQL): role, role claim, menu, menu function, role menu.
-- Column names are snake_case; the API maps them to camelCase (new_id -> newId).

CREATE TABLE IF NOT EXISTS core_role (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id       uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name         varchar(100) NOT NULL UNIQUE,
    is_active    boolean      NOT NULL DEFAULT true,
    created_by   varchar(100),
    created_date timestamptz  NOT NULL DEFAULT now(),
    updated_by   varchar(100),
    updated_date timestamptz
);

CREATE TABLE IF NOT EXISTS core_role_claim (
    id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_id             uuid         NOT NULL REFERENCES core_role (new_id), -- core_role.new_id
    user_principal_name varchar(256) NOT NULL,
    employee_name       varchar(200),
    is_active           boolean      NOT NULL DEFAULT true,
    created_by          varchar(100),
    created_date        timestamptz  NOT NULL DEFAULT now(),
    updated_by          varchar(100),
    updated_date        timestamptz,
    CONSTRAINT uq_core_role_claim_role_user UNIQUE (role_id, user_principal_name)
);

CREATE TABLE IF NOT EXISTS core_menu (
    id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id         uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name           varchar(100) NOT NULL,
    parent_id      uuid         REFERENCES core_menu (new_id),            -- core_menu.new_id
    seq            integer,
    icon           varchar(100),
    path           varchar(255),
    is_development boolean      NOT NULL DEFAULT false,
    is_visible     boolean      NOT NULL DEFAULT true,
    is_active      boolean      NOT NULL DEFAULT true,
    created_date   timestamptz  NOT NULL DEFAULT now(),
    created_by     varchar(100),
    updated_date   timestamptz,
    updated_by     varchar(100)
);

CREATE TABLE IF NOT EXISTS core_menu_function (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id       uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name         varchar(100) NOT NULL,
    menu_new_id  uuid         NOT NULL REFERENCES core_menu (new_id),
    path         varchar(255),
    is_active    boolean      NOT NULL DEFAULT true,
    created_by   varchar(100),
    created_date timestamptz  NOT NULL DEFAULT now(),
    updated_by   varchar(100),
    updated_date timestamptz
);

-- Menu access row:     function_new_id IS NULL, uses is_active.
-- Function access row: function_new_id set,     uses is_active_btn.
CREATE TABLE IF NOT EXISTS core_role_menu (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    role_new_id     uuid        NOT NULL REFERENCES core_role (new_id),
    menu_new_id     uuid        NOT NULL REFERENCES core_menu (new_id),
    function_new_id uuid        REFERENCES core_menu_function (new_id),
    is_active       boolean     NOT NULL DEFAULT false,
    is_active_btn   boolean     NOT NULL DEFAULT false,
    created_by      varchar(100),
    created_date    timestamptz NOT NULL DEFAULT now(),
    updated_by      varchar(100),
    updated_date    timestamptz
);

-- NULLs are distinct in unique indexes, so menu rows and function rows each get their own index.
CREATE UNIQUE INDEX IF NOT EXISTS ux_core_role_menu_menu
    ON core_role_menu (role_new_id, menu_new_id) WHERE function_new_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_core_role_menu_function
    ON core_role_menu (role_new_id, menu_new_id, function_new_id) WHERE function_new_id IS NOT NULL;

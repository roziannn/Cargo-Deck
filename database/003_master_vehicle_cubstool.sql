-- Master data: vehicle and cubstool. Safe to re-run.
CREATE TABLE IF NOT EXISTS mst_vehicle (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id       uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name         varchar(150) NOT NULL,
    type         varchar(100),
    climate      varchar(100),
    cbm          numeric(14,4),
    dimensions_l numeric(14,4),   -- length (m)
    dimensions_w numeric(14,4),   -- width (m)
    floor_area   numeric(14,4),   -- m2
    max_height   numeric(14,4),   -- m
    is_active    boolean      NOT NULL DEFAULT true,
    created_by   varchar(100),
    created_date timestamptz  NOT NULL DEFAULT now(),
    updated_by   varchar(100),
    updated_date timestamptz
);

CREATE TABLE IF NOT EXISTS mst_cubstool (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    new_id       uuid         NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name         varchar(150) NOT NULL,
    item_code    varchar(100) NOT NULL,
    length       numeric(14,4),
    width        numeric(14,4),
    height       numeric(14,4),
    weight       numeric(14,4),
    color        varchar(50),
    is_active    boolean      NOT NULL DEFAULT true,
    created_by   varchar(100),
    created_date timestamptz  NOT NULL DEFAULT now(),
    updated_by   varchar(100),
    updated_date timestamptz
);

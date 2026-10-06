/* Core access-control tables: Role, RoleClaim, Menu, MenuFunction, RoleMenu */

IF OBJECT_ID('[dbo].[CORE_Role]') IS NULL
CREATE TABLE [dbo].[CORE_Role] (
    [Id]          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CORE_Role PRIMARY KEY,
    [NewId]       UNIQUEIDENTIFIER  NOT NULL CONSTRAINT DF_CORE_Role_NewId DEFAULT NEWID(),
    [Name]        NVARCHAR(100)     NOT NULL,
    [IsActive]    BIT               NOT NULL CONSTRAINT DF_CORE_Role_IsActive DEFAULT 1,
    [CreatedBy]   NVARCHAR(100)     NULL,
    [CreatedDate] DATETIME2         NOT NULL CONSTRAINT DF_CORE_Role_CreatedDate DEFAULT SYSDATETIME(),
    [UpdatedBy]   NVARCHAR(100)     NULL,
    [UpdatedDate] DATETIME2         NULL,
    CONSTRAINT UQ_CORE_Role_NewId UNIQUE ([NewId]),
    CONSTRAINT UQ_CORE_Role_Name  UNIQUE ([Name])
);
GO

IF OBJECT_ID('[dbo].[CORE_RoleClaim]') IS NULL
CREATE TABLE [dbo].[CORE_RoleClaim] (
    [Id]                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CORE_RoleClaim PRIMARY KEY,
    [RoleId]            UNIQUEIDENTIFIER  NOT NULL, -- CORE_Role.NewId
    [UserPrincipalName] NVARCHAR(256)     NOT NULL,
    [EmployeeName]      NVARCHAR(200)     NULL,
    [IsActive]          BIT               NOT NULL CONSTRAINT DF_CORE_RoleClaim_IsActive DEFAULT 1,
    [CreatedBy]         NVARCHAR(100)     NULL,
    [CreatedDate]       DATETIME2         NOT NULL CONSTRAINT DF_CORE_RoleClaim_CreatedDate DEFAULT SYSDATETIME(),
    [UpdatedBy]         NVARCHAR(100)     NULL,
    [UpdatedDate]       DATETIME2         NULL,
    CONSTRAINT FK_CORE_RoleClaim_Role FOREIGN KEY ([RoleId]) REFERENCES [dbo].[CORE_Role]([NewId]),
    CONSTRAINT UQ_CORE_RoleClaim_Role_User UNIQUE ([RoleId], [UserPrincipalName])
);
GO

IF OBJECT_ID('[dbo].[CORE_Menu]') IS NULL
CREATE TABLE [dbo].[CORE_Menu] (
    [Id]            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CORE_Menu PRIMARY KEY,
    [NewId]         UNIQUEIDENTIFIER  NOT NULL CONSTRAINT DF_CORE_Menu_NewId DEFAULT NEWID(),
    [Name]          NVARCHAR(100)     NOT NULL,
    [ParentId]      UNIQUEIDENTIFIER  NULL,     -- CORE_Menu.NewId
    [Seq]           INT               NULL,
    [Icon]          NVARCHAR(100)     NULL,
    [Path]          NVARCHAR(255)     NULL,
    [IsDevelopment] BIT               NOT NULL CONSTRAINT DF_CORE_Menu_IsDevelopment DEFAULT 0,
    [IsVisible]     BIT               NOT NULL CONSTRAINT DF_CORE_Menu_IsVisible DEFAULT 1,
    [IsActive]      BIT               NOT NULL CONSTRAINT DF_CORE_Menu_IsActive DEFAULT 1,
    [CreatedDate]   DATETIME2         NOT NULL CONSTRAINT DF_CORE_Menu_CreatedDate DEFAULT SYSDATETIME(),
    [CreatedBy]     NVARCHAR(100)     NULL,
    [UpdatedDate]   DATETIME2         NULL,
    [UpdatedBy]     NVARCHAR(100)     NULL,
    CONSTRAINT UQ_CORE_Menu_NewId UNIQUE ([NewId]),
    CONSTRAINT FK_CORE_Menu_Parent FOREIGN KEY ([ParentId]) REFERENCES [dbo].[CORE_Menu]([NewId])
);
GO

IF OBJECT_ID('[dbo].[CORE_MenuFunction]') IS NULL
CREATE TABLE [dbo].[CORE_MenuFunction] (
    [Id]          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CORE_MenuFunction PRIMARY KEY,
    [NewId]       UNIQUEIDENTIFIER  NOT NULL CONSTRAINT DF_CORE_MenuFunction_NewId DEFAULT NEWID(),
    [Name]        NVARCHAR(100)     NOT NULL,
    [MenuNewId]   UNIQUEIDENTIFIER  NOT NULL,   -- CORE_Menu.NewId
    [Path]        NVARCHAR(255)     NULL,
    [IsActive]    BIT               NOT NULL CONSTRAINT DF_CORE_MenuFunction_IsActive DEFAULT 1,
    [CreatedBy]   NVARCHAR(100)     NULL,
    [CreatedDate] DATETIME2         NOT NULL CONSTRAINT DF_CORE_MenuFunction_CreatedDate DEFAULT SYSDATETIME(),
    [UpdatedBy]   NVARCHAR(100)     NULL,
    [UpdatedDate] DATETIME2         NULL,
    CONSTRAINT UQ_CORE_MenuFunction_NewId UNIQUE ([NewId]),
    CONSTRAINT FK_CORE_MenuFunction_Menu FOREIGN KEY ([MenuNewId]) REFERENCES [dbo].[CORE_Menu]([NewId])
);
GO

/* Menu access row: FunctionNewId IS NULL, uses IsActive.
   Function (button) access row: FunctionNewId set, uses IsActiveBtn. */
IF OBJECT_ID('[dbo].[CORE_RoleMenu]') IS NULL
CREATE TABLE [dbo].[CORE_RoleMenu] (
    [Id]            INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CORE_RoleMenu PRIMARY KEY,
    [RoleNewId]     UNIQUEIDENTIFIER  NOT NULL,
    [MenuNewId]     UNIQUEIDENTIFIER  NOT NULL,
    [FunctionNewId] UNIQUEIDENTIFIER  NULL,
    [IsActive]      BIT               NOT NULL CONSTRAINT DF_CORE_RoleMenu_IsActive DEFAULT 0,
    [IsActiveBtn]   BIT               NOT NULL CONSTRAINT DF_CORE_RoleMenu_IsActiveBtn DEFAULT 0,
    [CreatedBy]     NVARCHAR(100)     NULL,
    [CreatedDate]   DATETIME2         NOT NULL CONSTRAINT DF_CORE_RoleMenu_CreatedDate DEFAULT SYSDATETIME(),
    [UpdatedBy]     NVARCHAR(100)     NULL,
    [UpdatedDate]   DATETIME2         NULL,
    CONSTRAINT FK_CORE_RoleMenu_Role     FOREIGN KEY ([RoleNewId])     REFERENCES [dbo].[CORE_Role]([NewId]),
    CONSTRAINT FK_CORE_RoleMenu_Menu     FOREIGN KEY ([MenuNewId])     REFERENCES [dbo].[CORE_Menu]([NewId]),
    CONSTRAINT FK_CORE_RoleMenu_Function FOREIGN KEY ([FunctionNewId]) REFERENCES [dbo].[CORE_MenuFunction]([NewId])
);
GO
CREATE UNIQUE INDEX UX_CORE_RoleMenu_Role_Menu_Function
    ON [dbo].[CORE_RoleMenu] ([RoleNewId], [MenuNewId], [FunctionNewId]);
GO

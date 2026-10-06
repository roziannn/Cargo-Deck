"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { getStoredAuthToken } from "@/lib/api/auth";
import { listCoreMenusByRoleId, updateRoleMenuAccess, updateRoleMenuFunctionAccess, type CoreMenuFunctionItem, type CoreMenuItem } from "@/lib/api/core-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronLeft, Circle } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

type RoleMenuNode = {
  newId: string;
  name: string;
  parentId: string | null;
  seq: number | null;
  isActive: boolean;
  functionBtn: RoleMenuButton[];
  subMenu: RoleMenuNode[];
};

type RoleMenuButton = {
  newId: string;
  name: string;
  path: string;
  isActive: boolean;
};

function normalizeMenuId(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function mapRoleMenuNode(item: CoreMenuItem): RoleMenuNode {
  return {
    newId: item.newId,
    name: item.name,
    parentId: item.parentId,
    seq: item.seq,
    isActive: item.isActive,
    functionBtn: item.functionBtn.map(mapRoleMenuButton),
    subMenu: item.subMenu.map(mapRoleMenuNode),
  };
}

function mapRoleMenuButton(item: CoreMenuFunctionItem): RoleMenuButton {
  return {
    newId: item.newId,
    name: item.name,
    path: item.path,
    isActive: item.isActive,
  };
}

function toggleMenuAccess(nodes: RoleMenuNode[], targetId: string, checked: boolean): RoleMenuNode[] {
  return nodes.map((node) => {
    if (node.newId === targetId) {
      return {
        ...node,
        isActive: checked,
      };
    }

    if (node.subMenu.length === 0) return node;

    return {
      ...node,
      subMenu: toggleMenuAccess(node.subMenu, targetId, checked),
    };
  });
}

function toggleButtonAccess(nodes: RoleMenuNode[], targetMenuId: string, buttonName: string, checked: boolean): RoleMenuNode[] {
  return nodes.map((node) => {
    if (node.newId === targetMenuId) {
      return {
        ...node,
        functionBtn: node.functionBtn.map((button) =>
          button.name === buttonName
            ? {
                ...button,
                isActive: checked,
              }
            : button,
        ),
      };
    }

    if (node.subMenu.length === 0) return node;

    return {
      ...node,
      subMenu: toggleButtonAccess(node.subMenu, targetMenuId, buttonName, checked),
    };
  });
}

export default function RolePermissionDetailPage() {
  const params = useParams<{ roleId: string }>();
  const roleId = typeof params?.roleId === "string" ? params.roleId : "";

  const [rows, setRows] = useState<RoleMenuNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingMenuIds, setPendingMenuIds] = useState<string[]>([]);
  const [pendingButtonIds, setPendingButtonIds] = useState<string[]>([]);

  const menuNameById = useMemo(() => {
    const entries: Array<readonly [string, string]> = [];
    const visit = (menus: RoleMenuNode[]) => {
      for (const menu of menus) {
        entries.push([normalizeMenuId(menu.newId), menu.name] as const);
        if (menu.subMenu.length > 0) visit(menu.subMenu);
      }
    };
    visit(rows);
    return new Map(entries);
  }, [rows]);

  const loadMenus = useCallback(async () => {
    if (!roleId) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const response = await listCoreMenusByRoleId(roleId, token);
      setRows(response.map(mapRoleMenuNode));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil permission menu.";
      toast.error(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    void loadMenus();
  }, [loadMenus]);

  async function handleToggleMenuAccess(menuId: string, checked: boolean) {
    const previousRows = rows;
    setRows((prev) => toggleMenuAccess(prev, menuId, checked));
    setPendingMenuIds((prev) => [...prev, menuId]);

    try {
      const token = getStoredAuthToken() ?? undefined;
      await updateRoleMenuAccess(roleId, menuId, { isActive: checked }, token);
      toast.success(`Menu access ${checked ? "enabled" : "disabled"}.`);
    } catch (error) {
      setRows(previousRows);
      const message = error instanceof Error ? error.message : "Gagal mengubah menu access.";
      toast.error(message);
    } finally {
      setPendingMenuIds((prev) => prev.filter((id) => id !== menuId));
    }
  }

  async function handleToggleButtonAccess(menuId: string, functionNewId: string, buttonName: string, checked: boolean) {
    if (!functionNewId) {
      toast.error("Function button ID tidak ditemukan.");
      return;
    }

    const previousRows = rows;
    setRows((prev) => toggleButtonAccess(prev, menuId, buttonName, checked));
    setPendingButtonIds((prev) => [...prev, functionNewId]);

    try {
      const token = getStoredAuthToken() ?? undefined;
      await updateRoleMenuFunctionAccess(roleId, functionNewId, { isActive: checked }, token);
      toast.success(`Function "${buttonName}" ${checked ? "enabled" : "disabled"}.`);
    } catch (error) {
      setRows(previousRows);
      const message = error instanceof Error ? error.message : "Gagal mengubah function button access.";
      toast.error(message);
    } finally {
      setPendingButtonIds((prev) => prev.filter((id) => id !== functionNewId));
    }
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-3">
        <Button asChild variant="outline" className="w-fit">
          <Link href="/settings/role">
            <ChevronLeft className="h-4 w-4" />
            Back to Role
          </Link>
        </Button>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Role Menu Access</h1>
          <p className="text-sm text-muted-foreground">View menu and function button access for role ID {roleId || "-"}.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Menu Name</TableHead>
              <TableHead>Parent Menu</TableHead>
              <TableHead>Sequence</TableHead>
              <TableHead>Function Buttons</TableHead>
              <TableHead className="w-40 text-center">Menu Access</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((parent) => (
              <Fragment key={parent.newId || parent.name}>
                <TableRow className="transition hover:bg-muted/40">
                  <TableCell>{parent.name}</TableCell>
                  <TableCell>{parent.parentId ? menuNameById.get(normalizeMenuId(parent.parentId)) || "-" : "-"}</TableCell>
                  <TableCell>{parent.seq ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {parent.functionBtn.length === 0 ? (
                        "No buttons"
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {parent.functionBtn.map((button) => (
                            <label
                              key={`${parent.newId}-${button.name}-${button.path}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                            >
                              <Checkbox
                                checked={button.isActive}
                                disabled={pendingButtonIds.includes(button.newId)}
                                onCheckedChange={(checked) => void handleToggleButtonAccess(parent.newId, button.newId, button.name, checked === true)}
                              />
                              <span>{button.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  <TableCell className="align-middle">
                    <div className="flex items-center justify-center gap-2">
                      <Checkbox checked={parent.isActive} disabled={pendingMenuIds.includes(parent.newId)} onCheckedChange={(checked) => void handleToggleMenuAccess(parent.newId, checked === true)} />
                      <span>{parent.isActive ? "Enabled" : "Disabled"}</span>
                    </div>
                  </TableCell>
                </TableRow>

                {parent.subMenu.map((child) => (
                  <TableRow key={child.newId || `${parent.newId}-${child.name}`} className="transition hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3 pl-6 text-muted-foreground">
                        <Circle className="h-3.5 w-3.5" />
                        <span className="text-foreground">{child.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{menuNameById.get(normalizeMenuId(child.parentId)) || parent.name}</TableCell>
                    <TableCell>{child.seq ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {child.functionBtn.length === 0 ? (
                        "No buttons"
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {child.functionBtn.map((button) => (
                            <label
                              key={`${child.newId}-${button.name}-${button.path}`}
                              className="inline-flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground"
                            >
                              <Checkbox
                                checked={button.isActive}
                                disabled={pendingButtonIds.includes(button.newId)}
                                onCheckedChange={(checked) => void handleToggleButtonAccess(child.newId, button.newId, button.name, checked === true)}
                              />
                              <span>{button.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <Checkbox checked={child.isActive} disabled={pendingMenuIds.includes(child.newId)} onCheckedChange={(checked) => void handleToggleMenuAccess(child.newId, checked === true)} />
                        <span>{child.isActive ? "Enabled" : "Disabled"}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}

            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Loading data...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

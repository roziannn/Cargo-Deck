"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { getStoredAuthToken, getStoredAuthUser } from "@/lib/api/auth";
import { searchDataHrisNameLov, type DataHrisLovUser } from "@/lib/api/data-hris";
import { addCoreRoleClaim, createCoreRole, listCoreRoleClaimsByRoleId, listCoreRoles, updateCoreRole, updateCoreRoleClaim, type CoreRoleClaimItem, type CoreRoleItem } from "@/lib/api/core-role";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toaster, toast } from "react-hot-toast";
import { Check, ChevronLeft, ChevronRight, CircleCheck, LoaderCircle, Plus, Search, Settings, SquarePen, Trash2 } from "lucide-react";
import { DateFormat } from "@/utils/date-format";

export default function RoleListPage() {
  const [rows, setRows] = useState<CoreRoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openForm, setOpenForm] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<CoreRoleItem | null>(null);
  const [actor, setActor] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openUserSelect, setOpenUserSelect] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userOptions, setUserOptions] = useState<DataHrisLovUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DataHrisLovUser | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<CoreRoleClaimItem[]>([]);
  const [isLoadingClaims, setIsLoadingClaims] = useState(false);
  const [isAddingClaim, setIsAddingClaim] = useState(false);
  const rowsPerPage = 8;

  const loadRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const response = await listCoreRoles(token);
      setRows(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data role.";
      toast.error(message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    const currentUser = getStoredAuthUser();
    setActor((currentUser?.name || currentUser?.username || currentUser?.email || "").trim());
  }, []);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((row) =>
      [row.name, row.createdBy, row.updatedBy, row.newId].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [rows, search]);

  const totalPages = Math.ceil(filtered.length / rowsPerPage);
  const startIndex = (page - 1) * rowsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + rowsPerPage);
  const totalEntries = filtered.length;
  const fromEntry = totalEntries === 0 ? 0 : Math.min(startIndex + 1, totalEntries);
  const toEntry = totalEntries === 0 ? 0 : Math.min(startIndex + rowsPerPage, totalEntries);

  function resetForm() {
    setName("");
    setIsActive(true);
    setMode("create");
    setSelected(null);
    setOpenUserSelect(false);
    setUserSearch("");
    setUserOptions([]);
    setSelectedUser(null);
    setSelectedUsers([]);
    setIsLoadingClaims(false);
  }

  function openCreate() {
    resetForm();
    setOpenForm(true);
  }

  function openEdit(row: CoreRoleItem) {
    setMode("edit");
    setSelected(row);
    setName(row.name);
    setIsActive(row.isActive);
    setOpenForm(true);
  }

  const loadRoleClaims = useCallback(async (roleId: string) => {
    setIsLoadingClaims(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const response = await listCoreRoleClaimsByRoleId(roleId, token);
      setSelectedUsers(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mengambil data user role.";
      toast.error(message);
      setSelectedUsers([]);
    } finally {
      setIsLoadingClaims(false);
    }
  }, []);

  useEffect(() => {
    if (!openForm || mode !== "edit" || !selected?.newId) return;
    void loadRoleClaims(selected.newId);
  }, [loadRoleClaims, mode, openForm, selected]);

  async function handleSave() {
    const normalizedName = name.trim();

    if (!normalizedName) {
      toast.error("Name wajib diisi.");
      return;
    }

    if (!actor) {
      toast.error("User login tidak ditemukan.");
      return;
    }

    setIsSaving(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      if (mode === "create") {
        await createCoreRole(
          {
            name: normalizedName,
            isActive,
            createdBy: actor,
          },
          token,
        );
        setPage(1);
        toast.success(`Role "${normalizedName}" berhasil disimpan.`);
      } else {
        const targetId = selected?.newId;
        if (!targetId) {
          throw new Error("ID role untuk update tidak ditemukan.");
        }

        await updateCoreRole(
          targetId,
          {
            name: normalizedName,
            isActive,
            updatedBy: actor,
          },
          token,
        );

        await updateCoreRoleClaim(
          targetId,
          {
            roleId: targetId,
            roleName: normalizedName,
            userPrincipalNames: selectedUsers.map((user) => user.userPrincipalName).filter(Boolean),
            updatedBy: actor,
            isActive,
          },
          token,
        );
        toast.success(`Perubahan role "${normalizedName}" berhasil disimpan.`);
      }

      await loadRoles();
      setOpenForm(false);
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan role.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSearchUsers(query: string) {
    setUserSearch(query);

    const keyword = query.trim();
    if (!keyword) {
      setUserOptions([]);
      return;
    }

    setIsSearchingUsers(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      const response = await searchDataHrisNameLov(keyword, token);
      setUserOptions(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal mencari user.";
      toast.error(message);
      setUserOptions([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }

  async function handleAddUserClaim() {
    if (mode !== "edit") return;

    const roleId = selected?.newId;
    if (!roleId) {
      toast.error("ID role tidak ditemukan.");
      return;
    }

    if (!selectedUser?.userPrincipalName) {
      toast.error("Pilih user terlebih dahulu.");
      return;
    }

    setIsAddingClaim(true);
    try {
      const token = getStoredAuthToken() ?? undefined;
      await addCoreRoleClaim(
        {
          roleId,
          userPrincipalName: selectedUser.userPrincipalName,
          employeeName: selectedUser.employeeName || selectedUser.name,
          isActive: true,
          createdBy: actor,
        },
        token,
      );

      await loadRoleClaims(roleId);
      toast.success(`User "${selectedUser.name}" berhasil ditambahkan.`);
      setSelectedUser(null);
      setUserSearch("");
      setUserOptions([]);
      setOpenUserSelect(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menambahkan user ke role.";
      toast.error(message);
    } finally {
      setIsAddingClaim(false);
    }
  }

  function handleRemoveSelectedUser(userPrincipalName: string) {
    setSelectedUsers((prev) => prev.filter((user) => user.userPrincipalName !== userPrincipalName));
  }

  return (
    <div className="min-h-screen space-y-6 p-6 dark:bg-zinc-900">
      <Toaster position="top-center" />

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Role</h1>
        <p className="text-sm text-muted-foreground">Manage core role data for manufacturing process control and monitoring.</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search role..."
            className="pl-9"
          />
        </div>

        <Button className="font-medium" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Role
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-background/40">
        <Table containerClassName="rounded-none border-0 bg-transparent">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead className="w-24 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginated.map((row) => (
              <TableRow key={row.newId || `${row.id}-${row.name}`} className="transition hover:bg-muted/40">
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  {row.isActive ? (
                    <Badge className="gap-1.5 border border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
                      <CircleCheck className="h-3 w-3" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell>{row.createdBy || "-"}</TableCell>
                <TableCell>{row.createdDate && row.createdDate !== "-" ? DateFormat(row.createdDate) : "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-3">
                    <SquarePen className="h-4 w-4 cursor-pointer text-muted-foreground transition hover:text-blue-600" onClick={() => openEdit(row)} />
                    <Link href={`/settings/role/${row.newId}`} className="text-muted-foreground transition hover:text-amber-600" aria-label={`Open permissions for ${row.name}`}>
                      <Settings className="h-4 w-4" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Loading data...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && paginated.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No data found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 border-t px-3 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {fromEntry} to {toEntry} of {totalEntries} entries
          </span>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center text-foreground">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages || totalPages === 0}
              onClick={() => setPage((prev) => prev + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={openForm}
        onOpenChange={(open) => {
          setOpenForm(open);
          if (!open && !isSaving) {
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add Role" : "Edit Role"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Input role name" maxLength={256} />
            </div>

            {mode === "edit" && (
              <div className="space-y-2">
                <Label>Name</Label>
                <div className="flex gap-2">
                  <Popover open={openUserSelect} onOpenChange={setOpenUserSelect}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                        {selectedUser ? selectedUser.name : "Choose a user..."}
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search name..." value={userSearch} onValueChange={handleSearchUsers} />
                        <CommandList>
                          {isSearchingUsers ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Searching users...</div>
                          ) : (
                            <>
                              <CommandEmpty>No user found.</CommandEmpty>
                              <CommandGroup>
                                {userOptions.map((user) => (
                                  <CommandItem
                                    key={user.userPrincipalName}
                                    value={`${user.name} ${user.userPrincipalName} ${user.employeeJobTitle}`}
                                    onSelect={() => {
                                      setSelectedUser(user);
                                      setOpenUserSelect(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${selectedUser?.userPrincipalName === user.userPrincipalName ? "opacity-100" : "opacity-0"}`} />
                                    <div className="flex flex-col">
                                      <span>{user.name}</span>
                                      <span className="text-xs text-muted-foreground">{user.userPrincipalName}</span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Button type="button" onClick={() => void handleAddUserClaim()} disabled={!selectedUser || isAddingClaim}>
                    {isAddingClaim ? "Adding..." : "Add"}
                  </Button>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium">Selected Users</p>
                  {isLoadingClaims ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading selected users...
                    </div>
                  ) : selectedUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No user selected.</p>
                  ) : (
                    selectedUsers.map((user) => (
                      <div key={`${user.roleId}-${user.userPrincipalName}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{user.employeeName || "-"}</p>
                          <p className="truncate text-xs text-muted-foreground">{user.userPrincipalName}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveSelectedUser(user.userPrincipalName)}
                          aria-label={`Remove ${user.employeeName || user.userPrincipalName}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="role-active">Is Active</Label>
                <p className="text-xs text-muted-foreground">{isActive ? "Role aktif" : "Role nonaktif"}</p>
              </div>
              <Switch id="role-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? "Saving..." : mode === "create" ? "Save" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

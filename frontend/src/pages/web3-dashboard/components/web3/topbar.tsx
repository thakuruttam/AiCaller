import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Megaphone, Plus } from "lucide-react";

import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { SidebarTrigger } from "../../ui/sidebar";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "../../ui/dropdown-menu";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../context/ToastContext";
import api from "../../../../api/axios";
import { Button as AppButton, Input as AppInput } from "../../../../components/ui";

// Tucked inside the account dropdown (as a submenu) rather than its own
// persistent sidebar row — switching workspace is rare enough that it
// shouldn't be something every page load puts in front of you.
export function WorkspaceSwitcherMenu() {
  const { user, workspaces, switchWorkspace, refreshWorkspaces } = useAuth();
  const { addToast } = useToast();
  const [switching, setSwitching] = React.useState(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newWsName, setNewWsName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const current = workspaces.find((w) => w.id === user?.workspaceId);

  const handleSwitch = async (workspaceId) => {
    if (workspaceId === user?.workspaceId) return;
    setSwitching(workspaceId);
    try {
      await switchWorkspace(workspaceId);
      window.location.reload();
    } catch {
      /* ignore */
    } finally {
      setSwitching(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/api/workspaces", { name: newWsName.trim() });
      await refreshWorkspaces();
      await switchWorkspace(data.id);
      window.location.reload();
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to create workspace", "error");
    } finally {
      setCreating(false);
    }
  };

  if (!current && user?.role !== "SUPER_ADMIN") return null;

  return (
    <DropdownMenuSub onOpenChange={(open) => { if (!open) setShowCreate(false); }}>
      <DropdownMenuSubTrigger>
        <span className="bg-gradient-to-br from-brand-450 to-brand-800 text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
          {current?.name?.charAt(0)?.toUpperCase() || "?"}
        </span>
        <span className="min-w-0 flex-1 truncate">{current?.name || "Switch workspace"}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-64">
        <DropdownMenuLabel>{current?.name || "Workspace"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces.filter((w) => w.id !== user?.workspaceId).map((w) => (
          <DropdownMenuItem key={w.id} disabled={!!switching} onClick={() => handleSwitch(w.id)}>
            <span className="bg-accent text-accent-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {switching === w.id ? "…" : w.name.charAt(0).toUpperCase()}
            </span>
            {w.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {showCreate ? (
          <form onSubmit={handleCreate} className="flex items-center gap-2 p-2">
            <Input
              autoFocus
              required
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Workspace name…"
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" disabled={creating || !newWsName.trim()}>
              {creating ? "…" : "Add"}
            </Button>
          </form>
        ) : (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowCreate(true); }}>
            <Plus className="size-4" />
            New workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function DashboardTopbar() {
  const navigate = useNavigate();

  return (
    <header className="flex min-h-16 items-center justify-between gap-4">
      <div className="flex w-full max-w-sm items-center gap-2">
        <SidebarTrigger className="shrink-0 lg:hidden" />
        <div className="flex-1">
          <AppInput
            icon="search"
            aria-label="Search campaigns, calls and contacts"
            placeholder="Search campaigns, calls, contacts..."
          />
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <AppButton className="px-5" onClick={() => navigate("/create-campaign")}>
          Create Campaign
          <Megaphone className="size-4" />
        </AppButton>
      </div>
    </header>
  );
}

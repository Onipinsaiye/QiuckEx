"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getQuickexApiBase } from "@/lib/api";
import { resolvePublicKey } from "@/lib/publicKey";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeamRole = "owner" | "admin" | "member" | "viewer";

interface TeamMember {
  id: string;
  email: string;
  role: TeamRole;
  status: "active" | "pending";
  joinedAt: string;
  lastActiveAt: string | null;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  ownerPublicKey: string;
  members: TeamMember[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchTeams(publicKey: string): Promise<Team[]> {
  const res = await fetch(
    `${getQuickexApiBase()}/teams?ownerPublicKey=${encodeURIComponent(publicKey)}`,
  );
  if (!res.ok) throw new Error(`Failed to load teams (${res.status})`);
  const data = (await res.json()) as { teams: Team[] };
  return data.teams;
}

async function createTeam(
  publicKey: string,
  name: string,
): Promise<Team> {
  const res = await fetch(
    `${getQuickexApiBase()}/teams?ownerPublicKey=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  if (!res.ok) throw new Error(`Failed to create team (${res.status})`);
  return res.json() as Promise<Team>;
}

async function inviteMember(
  teamId: string,
  actorPublicKey: string,
  email: string,
  role: Exclude<TeamRole, "owner">,
): Promise<TeamMember> {
  const res = await fetch(
    `${getQuickexApiBase()}/teams/${teamId}/members?actorPublicKey=${encodeURIComponent(actorPublicKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Invite failed (${res.status})`);
  }
  return res.json() as Promise<TeamMember>;
}

async function removeMember(
  teamId: string,
  memberId: string,
  actorPublicKey: string,
): Promise<void> {
  const res = await fetch(
    `${getQuickexApiBase()}/teams/${teamId}/members/${memberId}?actorPublicKey=${encodeURIComponent(actorPublicKey)}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`Remove member failed (${res.status})`);
}

async function updateMemberRole(
  teamId: string,
  memberId: string,
  role: Exclude<TeamRole, "owner">,
  actorPublicKey: string,
): Promise<TeamMember> {
  const res = await fetch(
    `${getQuickexApiBase()}/teams/${teamId}/members/${memberId}/role?actorPublicKey=${encodeURIComponent(actorPublicKey)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    },
  );
  if (!res.ok) throw new Error(`Role update failed (${res.status})`);
  return res.json() as Promise<TeamMember>;
}

async function generateInviteLink(
  teamId: string,
  actorPublicKey: string,
): Promise<{ inviteUrl: string; expiresAt: string }> {
  const res = await fetch(
    `${getQuickexApiBase()}/teams/${teamId}/invite-link?actorPublicKey=${encodeURIComponent(actorPublicKey)}`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Invite link generation failed (${res.status})`);
  return res.json() as Promise<{ inviteUrl: string; expiresAt: string }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function roleLabel(role: TeamRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function roleBadgeClass(role: TeamRole): string {
  switch (role) {
    case "owner":   return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
    case "admin":   return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    case "member":  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    default:        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamSettings() {
  const publicKey = resolvePublicKey();

  const [teams, setTeams]               = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [toastMsg, setToastMsg]         = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteRole, setInviteRole]     = useState<Exclude<TeamRole, "owner">>("member");
  const [inviting, setInviting]         = useState(false);

  // New team form
  const [newTeamName, setNewTeamName]   = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [showNewTeamForm, setShowNewTeamForm] = useState(false);

  // Invite link state
  const [inviteLink, setInviteLink]     = useState<string | null>(null);
  const [inviteLinkExpiry, setInviteLinkExpiry] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load teams
  // ---------------------------------------------------------------------------

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTeams(publicKey);
      setTeams(data);
      if (data.length > 0 && !selectedTeam) {
        setSelectedTeam(data[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [publicKey, selectedTeam]);

  useEffect(() => {
    void loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const team = await createTeam(publicKey, newTeamName.trim());
      setTeams((prev) => [...prev, team]);
      setSelectedTeam(team);
      setNewTeamName("");
      setShowNewTeamForm(false);
      showToast("Team created");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const member = await inviteMember(selectedTeam.id, publicKey, inviteEmail.trim(), inviteRole);
      setSelectedTeam((prev) =>
        prev ? { ...prev, members: [...prev.members, member] } : prev,
      );
      setTeams((prev) =>
        prev.map((t) =>
          t.id === selectedTeam.id
            ? { ...t, members: [...t.members, member] }
            : t,
        ),
      );
      setInviteEmail("");
      showToast(`Invited ${member.email}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!selectedTeam) return;
    try {
      await removeMember(selectedTeam.id, member.id, publicKey);
      const filtered = selectedTeam.members.filter((m) => m.id !== member.id);
      setSelectedTeam({ ...selectedTeam, members: filtered });
      setTeams((prev) =>
        prev.map((t) =>
          t.id === selectedTeam.id ? { ...t, members: filtered } : t,
        ),
      );
      showToast(`Removed ${member.email}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const handleRoleChange = async (
    member: TeamMember,
    newRole: Exclude<TeamRole, "owner">,
  ) => {
    if (!selectedTeam) return;
    try {
      const updated = await updateMemberRole(selectedTeam.id, member.id, newRole, publicKey);
      const updatedMembers = selectedTeam.members.map((m) =>
        m.id === updated.id ? updated : m,
      );
      setSelectedTeam({ ...selectedTeam, members: updatedMembers });
      setTeams((prev) =>
        prev.map((t) =>
          t.id === selectedTeam.id ? { ...t, members: updatedMembers } : t,
        ),
      );
      showToast("Role updated");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleGenerateInviteLink = async () => {
    if (!selectedTeam) return;
    try {
      const { inviteUrl, expiresAt } = await generateInviteLink(selectedTeam.id, publicKey);
      setInviteLink(inviteUrl);
      setInviteLinkExpiry(expiresAt);
      showToast("Invite link generated (valid 7 days)");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate invite link");
    }
  };

  const currentUserRole: TeamRole =
    selectedTeam?.members.find((m) => m.email === publicKey)?.role ?? "viewer";
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative min-h-screen text-foreground">
      {/* Background glow */}
      <div className="fixed top-[-20%] left-[-30%] w-[60%] h-[60%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-card border border-border rounded-2xl shadow-xl text-sm font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-4">
          <span className="text-emerald-400">✓</span> {toastMsg}
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden md:flex w-72 h-screen fixed left-0 top-0 border-r border-border bg-card backdrop-blur-3xl flex-col z-20">
        <nav className="flex-1 px-4 py-10 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 text-subtle hover:text-foreground hover:bg-surface rounded-2xl font-semibold transition">
            <span>📊</span> Dashboard
          </Link>
          <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-subtle hover:text-foreground hover:bg-surface rounded-2xl font-semibold transition">
            <span>⚙️</span> Profile Settings
          </Link>
          <Link href="/settings/teams" className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-2xl font-bold">
            <span className="text-indigo-400">👥</span> Team Management
          </Link>
        </nav>
      </aside>

      <main className="relative z-10 p-4 sm:p-6 md:p-12 md:ml-72">
        <header className="mb-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-2">Team Management</h1>
            <p className="text-subtle font-medium">Manage members, roles, and workspace permissions.</p>
          </div>
          <button
            onClick={() => setShowNewTeamForm(true)}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold rounded-xl transition"
          >
            + New Team
          </button>
        </header>

        {/* Tab nav */}
        <nav className="flex gap-3 mb-8">
          <Link href="/settings" className="px-4 py-2 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface transition">
            General
          </Link>
          <Link href="/settings/teams" className="px-4 py-2 rounded-xl border border-border-strong bg-surface-strong text-sm font-semibold">
            Team
          </Link>
          <Link href="/settings/developer" className="px-4 py-2 rounded-xl border border-border-strong text-sm font-semibold hover:bg-surface transition">
            Developer
          </Link>
        </nav>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3">
            <span>⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* New team form */}
        {showNewTeamForm && (
          <div className="mb-8 p-6 rounded-3xl bg-card border border-border">
            <h2 className="text-lg font-bold mb-4">Create a new team</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                onKeyDown={(e) => e.key === "Enter" && void handleCreateTeam()}
                className="flex-1 bg-surface border border-border-strong rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 transition"
              />
              <button
                onClick={() => void handleCreateTeam()}
                disabled={creatingTeam || !newTeamName.trim()}
                className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition"
              >
                {creatingTeam ? "Creating…" : "Create"}
              </button>
              <button
                onClick={() => { setShowNewTeamForm(false); setNewTeamName(""); }}
                className="px-4 py-2 text-sm text-subtle hover:text-foreground border border-border rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Team selector (if multiple) */}
        {teams.length > 1 && (
          <div className="mb-6 flex gap-3 flex-wrap">
            {teams.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTeam(t)}
                className={`px-4 py-2 rounded-xl border text-sm font-semibold transition ${
                  selectedTeam?.id === t.id
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "border-border text-subtle hover:text-foreground hover:bg-surface"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-5xl">👥</div>
            <p className="text-subtle font-medium">No teams yet. Create one to get started.</p>
            <button
              onClick={() => setShowNewTeamForm(true)}
              className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold rounded-xl transition"
            >
              + New Team
            </button>
          </div>
        ) : selectedTeam ? (
          <>
            {/* Member list */}
            <div className="rounded-3xl bg-card border border-border overflow-hidden mb-8">
              <div className="p-6 border-b border-border flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
                  {selectedTeam.description && (
                    <p className="text-subtle text-sm mt-1">{selectedTeam.description}</p>
                  )}
                </div>
                <div className="flex gap-3">
                  {canManage && (
                    <button
                      onClick={() => void handleGenerateInviteLink()}
                      className="px-4 py-2 border border-border-strong text-sm font-semibold rounded-xl hover:bg-surface transition"
                    >
                      🔗 Invite Link
                    </button>
                  )}
                </div>
              </div>

              {/* Invite link banner */}
              {inviteLink && (
                <div className="px-6 py-4 bg-indigo-500/5 border-b border-border flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-subtle mb-1">Invite link (expires {formatDate(inviteLinkExpiry)})</p>
                    <code className="text-xs text-indigo-400 break-all">{inviteLink}</code>
                  </div>
                  <button
                    onClick={() => void navigator.clipboard.writeText(inviteLink ?? "").then(() => showToast("Copied!"))}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/20 transition shrink-0"
                  >
                    Copy
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-subtle text-xs font-bold uppercase tracking-wider border-b border-border">
                      <th className="px-6 py-4">Member</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4">Last Active</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedTeam.members.map((member) => (
                      <tr key={member.id} className="hover:bg-card/[0.02] transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-surface-strong rounded-full flex items-center justify-center font-bold text-indigo-400 text-sm shrink-0">
                              {member.email[0]?.toUpperCase()}
                            </div>
                            <p className="text-sm font-semibold truncate max-w-[200px]">{member.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {canManage && member.role !== "owner" ? (
                            <select
                              value={member.role}
                              onChange={(e) =>
                                void handleRoleChange(
                                  member,
                                  e.target.value as Exclude<TeamRole, "owner">,
                                )
                              }
                              className="bg-card border border-border-strong rounded-lg px-2 py-1 text-sm outline-none focus:border-indigo-500 transition"
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : (
                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${roleBadgeClass(member.role)}`}
                            >
                              {roleLabel(member.role)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-subtle">
                          {formatDate(member.joinedAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-subtle">
                          {formatDate(member.lastActiveAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${
                              member.status === "active"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : "bg-amber-500/10 text-amber-500"
                            }`}
                          >
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canManage && member.role !== "owner" && (
                            <button
                              onClick={() => void handleRemoveMember(member)}
                              className="p-2 text-subtle hover:text-red-400 transition"
                              title="Remove member"
                            >
                              🗑️
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invite form */}
            {canManage && (
              <div className="rounded-3xl bg-card border border-border p-6 mb-8">
                <h2 className="text-lg font-bold mb-4">Invite a member</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email address"
                    className="flex-1 bg-surface border border-border-strong rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 transition"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Exclude<TeamRole, "owner">)}
                    className="bg-surface border border-border-strong rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-500 transition"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => void handleInvite()}
                    disabled={inviting || !inviteEmail.trim()}
                    className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition"
                  >
                    {inviting ? "Sending…" : "Invite"}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* Role descriptions */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { color: "text-indigo-400",  label: "Owner",  desc: "Full access. Can delete or transfer the team." },
            { color: "text-purple-400",  label: "Admin",  desc: "Manage members and invite links. Cannot delete the team." },
            { color: "text-emerald-400", label: "Member", desc: "Manage links and view analytics. Cannot change team settings." },
            { color: "text-slate-400",   label: "Viewer", desc: "Read-only access to dashboard and analytics." },
          ].map(({ color, label, desc }) => (
            <div key={label} className="p-5 rounded-2xl bg-surface border border-border">
              <p className={`${color} font-black text-xs uppercase mb-2`}>{label}</p>
              <p className="text-sm text-subtle">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

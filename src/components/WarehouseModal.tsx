"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, Check, Trash2, LogOut } from "lucide-react";
import { ModalShell } from "./ui/ModalShell";
import { Label } from "./ui/Card";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useToast } from "./ui/Toast";
import { addWarehouse, renameWarehouse, deleteWarehouse } from "@/lib/actions";
import {
  changeAdminPassword,
  getAdminProfile,
  logoutAdmin,
  updateAdminEmail,
} from "@/lib/auth-actions";

type Warehouse = { id: number; name: string };

export default function WarehouseModal({
  warehouses,
  onClose,
}: {
  warehouses: Warehouse[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"account" | "warehouses">("account");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Warehouse | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    getAdminProfile().then((p) => {
      setUsername(p.username);
      setEmail(p.email);
    });
  }, []);

  function submitAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      await addWarehouse(newName.trim());
      toast(`Warehouse "${newName.trim()}" added`);
      setNewName("");
    });
  }

  function startEdit(w: Warehouse) {
    setEditingId(w.id);
    setEditingName(w.name);
  }

  function saveEdit() {
    if (!editingName.trim() || editingId === null) return;
    startTransition(async () => {
      await renameWarehouse(editingId!, editingName.trim());
      toast(`Warehouse renamed to "${editingName.trim()}"`);
      setEditingId(null);
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      await deleteWarehouse(deleteTarget.id);
      toast(`Warehouse "${deleteTarget.name}" deleted`, "info");
      setDeleteTarget(null);
    });
  }

  function saveEmail() {
    startTransition(async () => {
      const result = await updateAdminEmail(email, emailPassword);
      if ("error" in result) {
        toast(result.error, "error");
        return;
      }
      setEmail(result.email);
      setEmailPassword("");
      toast("Email updated");
    });
  }

  function savePassword() {
    startTransition(async () => {
      const result = await changeAdminPassword(currentPassword, newPassword, confirmPassword);
      if ("error" in result) {
        toast(result.error, "error");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password changed");
    });
  }

  return (
    <>
      <ModalShell title="Settings" onClose={onClose}>
        <div
          className="flex rounded-2xl p-1 mb-4"
          style={{ background: "var(--surface-soft)" }}
        >
          <button
            type="button"
            className="flex-1 text-xs font-semibold py-2 rounded-xl border-none"
            style={
              tab === "account"
                ? { background: "var(--surface)", color: "var(--accent)" }
                : { background: "transparent", color: "var(--text-muted)" }
            }
            onClick={() => setTab("account")}
          >
            Account
          </button>
          <button
            type="button"
            className="flex-1 text-xs font-semibold py-2 rounded-xl border-none"
            style={
              tab === "warehouses"
                ? { background: "var(--surface)", color: "var(--accent)" }
                : { background: "transparent", color: "var(--text-muted)" }
            }
            onClick={() => setTab("warehouses")}
          >
            Warehouses
          </button>
        </div>

        {tab === "account" && (
          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <input className="field" value={username} readOnly />
            </div>

            <div>
              <Label>Email (for password reset OTP)</Label>
              <input
                className="field mb-2"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Label>Confirm with current password</Label>
              <div className="flex gap-2">
                <input
                  className="field"
                  type="password"
                  placeholder="Current password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                />
                <button className="btn btn-primary shrink-0" onClick={saveEmail} disabled={pending}>
                  Save
                </button>
              </div>
            </div>

            <div className="pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="text-sm font-semibold themed-title mb-3">Change password</div>
              <Label>Current password</Label>
              <input
                className="field mb-2"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <Label>New password</Label>
              <input
                className="field mb-2"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Label>Confirm new password</Label>
              <input
                className="field mb-3"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button className="btn btn-primary w-full" onClick={savePassword} disabled={pending}>
                Update password
              </button>
            </div>

            <button
              className="btn w-full mt-1"
              onClick={() => startTransition(() => logoutAdmin())}
            >
              <LogOut size={14} className="inline -mt-0.5" /> Log out
            </button>
          </div>
        )}

        {tab === "warehouses" && (
          <>
            <div className="flex flex-col gap-2 mb-3.5">
              {warehouses.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 rounded-md p-2 transition-colors"
                  style={{ border: "1px solid var(--border-strong)" }}
                >
                  {editingId === w.id ? (
                    <input
                      className="field p-1"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      autoFocus
                    />
                  ) : (
                    <span className="flex-1 text-sm themed-title">{w.name}</span>
                  )}
                  {editingId === w.id ? (
                    <button className="btn px-2.5 py-1" onClick={saveEdit}>
                      <Check size={13} />
                    </button>
                  ) : (
                    <button className="btn px-2.5 py-1" onClick={() => startEdit(w)}>
                      Rename
                    </button>
                  )}
                  <button
                    className="btn btn-danger px-2.5 py-1"
                    onClick={() => setDeleteTarget(w)}
                    disabled={warehouses.length <= 1 || pending}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            <Label>Add new warehouse</Label>
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="e.g. Shamli Outlet"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
              />
              <button className="btn btn-primary" onClick={submitAdd} disabled={pending}>
                <Plus size={14} className="inline -mt-0.5" /> Add
              </button>
            </div>
            <div className="text-xs themed-muted mt-2.5">
              New warehouses start with zero stock across all SKUs. Deleting a warehouse removes its stock records — past bills stay in history.
            </div>
          </>
        )}
      </ModalShell>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete warehouse?"
          message={`"${deleteTarget.name}" and all its stock records will be permanently removed. Bills already created from this warehouse will keep their history.`}
          confirmLabel="Delete warehouse"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}

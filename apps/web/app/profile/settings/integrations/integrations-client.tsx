"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PluginAuthTokenKind } from "@saas/plugins-core";
import { authTokensApi, ApiError, type AuthTokenDTO } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface IntegrationsClientProps {
  pluginId: string;
  tokenKinds: PluginAuthTokenKind[];
  appName: string;
}

const EXPIRY_OPTIONS = [
  { value: "", label: "Never expires" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "365", label: "1 year" },
];

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatLastUsed(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(value);
}

function buildInitialRecord<T>(
  kinds: PluginAuthTokenKind[],
  createValue: () => T,
): Record<string, T> {
  return kinds.reduce<Record<string, T>>((acc, kind) => {
    acc[kind.id] = createValue();
    return acc;
  }, {});
}

export default function IntegrationsClient({
  pluginId,
  tokenKinds,
  appName,
}: IntegrationsClientProps): React.ReactElement {
  const kindIds = useMemo(() => tokenKinds.map((kind) => kind.id), [tokenKinds]);
  const tokenKindsById = useMemo(
    () => new Map(tokenKinds.map((kind) => [kind.id, kind])),
    [tokenKinds],
  );

  const [activeKind, setActiveKind] = useState<string>(() => kindIds[0] ?? "");
  const [tokensByKind, setTokensByKind] = useState<Record<string, AuthTokenDTO[]>>(() =>
    buildInitialRecord<AuthTokenDTO[]>(tokenKinds, () => []),
  );
  const [loading, setLoading] = useState<Record<string, boolean>>(() =>
    buildInitialRecord<boolean>(tokenKinds, () => true),
  );
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRevokeOpen, setIsRevokeOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AuthTokenDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const [tokenName, setTokenName] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeConfig = tokenKindsById.get(activeKind) ?? tokenKinds[0];
  const revokeKind = revokeTarget?.kind ?? activeKind;
  const revokeConfig = tokenKindsById.get(revokeKind) ?? activeConfig;

  useEffect(() => {
    if (!activeKind && kindIds.length > 0) {
      setActiveKind(kindIds[0]);
    } else if (activeKind && !tokenKindsById.has(activeKind) && kindIds.length > 0) {
      setActiveKind(kindIds[0]);
    }
  }, [activeKind, kindIds, tokenKindsById]);

  useEffect(() => {
    setTokensByKind((prev) => {
      const next = buildInitialRecord<AuthTokenDTO[]>(tokenKinds, () => []);
      for (const [kindId, tokens] of Object.entries(prev)) {
        if (kindId in next) {
          next[kindId] = tokens;
        }
      }
      return next;
    });

    setLoading((prev) => {
      const next = buildInitialRecord<boolean>(tokenKinds, () => true);
      for (const [kindId, value] of Object.entries(prev)) {
        if (kindId in next) {
          next[kindId] = value;
        }
      }
      return next;
    });
  }, [tokenKinds]);

  const resetCreateForm = useCallback((kindId: string): void => {
    const kindConfig = tokenKindsById.get(kindId);
    setTokenName("");
    setExpiryDays("");
    setCreatedTokenValue(null);
    setCopied(false);
    setSelectedScopes(
      kindConfig?.scopes
        .filter((scope) => scope.defaultChecked)
        .map((scope) => scope.id) ?? [],
    );
  }, [tokenKindsById]);

  const loadTokens = useCallback(async (kind: string): Promise<void> => {
    if (!pluginId) return;
    setLoading((prev) => ({ ...prev, [kind]: true }));
    try {
      const tokens = await authTokensApi.list({
        pluginId,
        kind,
      });
      setTokensByKind((prev) => ({ ...prev, [kind]: tokens }));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load integration tokens");
      }
    } finally {
      setLoading((prev) => ({ ...prev, [kind]: false }));
    }
  }, [pluginId]);

  useEffect(() => {
    if (kindIds.length === 0) return;
    void Promise.all(kindIds.map((kind) => loadTokens(kind)));
  }, [kindIds, loadTokens]);

  useEffect(() => {
    if (!activeKind) return;
    resetCreateForm(activeKind);
  }, [activeKind, resetCreateForm]);

  const handleToggleScope = (scopeId: string): void => {
    setSelectedScopes((prev) => {
      if (prev.includes(scopeId)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== scopeId);
      }
      return [...prev, scopeId];
    });
  };

  const handleCreate = async (): Promise<void> => {
    if (!tokenName.trim() || selectedScopes.length === 0 || !activeConfig) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const payload: {
        pluginId: string;
        kind: string;
        name: string;
        scopes: string[];
        expiresAt?: string;
      } = {
        pluginId,
        kind: activeConfig.id,
        name: tokenName.trim(),
        scopes: selectedScopes,
      };

      if (expiryDays) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + Number.parseInt(expiryDays, 10));
        payload.expiresAt = expiresAt.toISOString();
      }

      const created = await authTokensApi.create(payload);
      setCreatedTokenValue(created.tokenValue);
      setTokensByKind((prev) => ({
        ...prev,
        [activeConfig.id]: [created.token, ...(prev[activeConfig.id] ?? [])],
      }));
      toast.success("Token created");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create token");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleOpenCreate = (): void => {
    if (!activeKind) return;
    resetCreateForm(activeKind);
    setError(null);
    setIsCreateOpen(true);
  };

  const handleCopyToken = async (): Promise<void> => {
    if (!createdTokenValue) return;
    await navigator.clipboard.writeText(createdTokenValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async (): Promise<void> => {
    if (!revokeTarget || !revokeConfig) return;

    setRevoking(true);
    try {
      await authTokensApi.revoke(revokeTarget.id, {
        pluginId,
        kind: revokeConfig.id,
      });
      setTokensByKind((prev) => ({
        ...prev,
        [revokeConfig.id]: (prev[revokeConfig.id] ?? []).filter(
          (token) => token.id !== revokeTarget.id,
        ),
      }));
      toast.success("Token revoked");
      setIsRevokeOpen(false);
      setRevokeTarget(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to revoke token");
      }
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Integrations</h1>
      <p className="text-muted-foreground mt-1">
        Manage integration tokens for {appName}.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tokenKinds.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No integrations are configured for this app yet.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeKind} onValueChange={setActiveKind} className="mt-6">
          <TabsList>
            {tokenKinds.map((kind) => (
              <TabsTrigger key={kind.id} value={kind.id}>
                {kind.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {tokenKinds.map((kind) => (
            <TabsContent key={kind.id} value={kind.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{kind.title}</CardTitle>
                      {kind.description && (
                        <CardDescription>{kind.description}</CardDescription>
                      )}
                    </div>
                    <Button onClick={handleOpenCreate}>Create token</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading[kind.id] ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (tokensByKind[kind.id] ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      {kind.emptyMessage ?? "No tokens created yet."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(tokensByKind[kind.id] ?? []).map((token) => (
                        <div key={token.id} className="rounded-lg border bg-muted/20 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="font-medium">{token.name}</div>
                              <div className="flex flex-wrap gap-1.5">
                                {token.scopes.map((scope) => (
                                  <Badge key={`${token.id}-${scope}`} variant="secondary" className="text-xs">
                                    {scope}
                                  </Badge>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Last used: {formatLastUsed(token.lastUsedAt)}</span>
                                <span>Created: {formatDate(token.createdAt)}</span>
                                <span>Expires: {formatDate(token.expiresAt)}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setRevokeTarget(token);
                                setIsRevokeOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Revoke token</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open && activeKind) {
            resetCreateForm(activeKind);
          }
        }}
      >
        <DialogContent showCloseButton={!createdTokenValue}>
          {createdTokenValue ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  Token created
                </DialogTitle>
                <DialogDescription>
                  Copy your token now. You will not be able to see it again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-md border bg-muted p-3 text-xs font-mono break-all">
                  {createdTokenValue}
                </div>
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-600" />
                  Store this token securely.
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => void handleCopyToken()}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
                <Button onClick={() => setIsCreateOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{activeConfig?.createTitle ?? "Create token"}</DialogTitle>
                <DialogDescription>
                  {activeConfig?.createDescription ?? "Generate an integration token."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token-name">Token name</Label>
                  <Input
                    id="token-name"
                    value={tokenName}
                    onChange={(event) => setTokenName(event.target.value)}
                    placeholder="e.g., Claude Desktop"
                  />
                </div>

                {activeConfig && (
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="space-y-2">
                      {activeConfig.scopes.map((scope) => {
                        const checked = selectedScopes.includes(scope.id);
                        return (
                          <label
                            key={scope.id}
                            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleScope(scope.id)}
                              className="mt-1 h-4 w-4"
                            />
                            <div>
                              <div className="text-sm font-medium">{scope.label}</div>
                              {scope.description && (
                                <div className="text-xs text-muted-foreground">
                                  {scope.description}
                                </div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="token-expiry">Expiration (optional)</Label>
                  <select
                    id="token-expiry"
                    value={expiryDays}
                    onChange={(event) => setExpiryDays(event.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    {EXPIRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleCreate()}
                  disabled={creating || !tokenName.trim() || selectedScopes.length === 0}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create token"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isRevokeOpen}
        onOpenChange={(open) => {
          setIsRevokeOpen(open);
          if (!open) {
            setRevokeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke token?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeConfig?.revokeMessage ?? "This action cannot be undone."}
              {revokeConfig?.revokeMessage ? " This action cannot be undone." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRevoke()} disabled={revoking}>
              {revoking ? "Revoking..." : "Revoke token"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

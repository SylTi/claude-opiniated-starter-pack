"use client";

import { useCallback, useEffect, useState } from "react";
import { adminBillingApi, ApiError } from "@/lib/api";
import type { SubscriptionTierDTO } from "@saas/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type TierFormState = {
  slug: string;
  name: string;
  level: string;
  maxTeamMembers: string;
  priceMonthly: string;
  yearlyDiscountPercent: string;
  features: string;
  isActive: boolean;
};

const defaultFormState: TierFormState = {
  slug: "",
  name: "",
  level: "0",
  maxTeamMembers: "",
  priceMonthly: "",
  yearlyDiscountPercent: "",
  features: "",
  isActive: true,
};

export default function AdminTiersPage(): React.ReactElement {
  const [tiers, setTiers] = useState<SubscriptionTierDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTierDTO | null>(null);
  const [formData, setFormData] = useState<TierFormState>(defaultFormState);

  const fetchTiers = useCallback(async (): Promise<void> => {
    try {
      const data = await adminBillingApi.listTiers();
      setTiers(data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to fetch tiers");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const resetForm = (): void => {
    setFormData(defaultFormState);
    setEditingTier(null);
  };

  const openCreateDialog = (): void => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (tier: SubscriptionTierDTO): void => {
    setEditingTier(tier);
    setFormData({
      slug: tier.slug,
      name: tier.name,
      level: String(tier.level),
      maxTeamMembers: tier.maxTeamMembers?.toString() ?? "",
      priceMonthly: tier.priceMonthly?.toString() ?? "",
      yearlyDiscountPercent: tier.yearlyDiscountPercent?.toString() ?? "",
      features: tier.features ? JSON.stringify(tier.features, null, 2) : "",
      isActive: tier.isActive,
    });
    setIsDialogOpen(true);
  };

  const buildPayload = (allowNullFeatures: boolean): {
    slug?: string;
    name?: string;
    level?: number;
    maxTeamMembers?: number | null;
    priceMonthly?: number | null;
    yearlyDiscountPercent?: number | null;
    features?: Record<string, unknown> | null;
    isActive?: boolean;
  } | null => {
    let features: Record<string, unknown> | null | undefined;
    if (!formData.features.trim()) {
      features = allowNullFeatures ? null : undefined;
    } else {
      try {
        const parsed = JSON.parse(formData.features);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
          toast.error("Features must be a JSON object");
          return null;
        }
        features = parsed as Record<string, unknown>;
      } catch {
        toast.error("Features must be valid JSON");
        return null;
      }
    }

    return {
      slug: formData.slug.trim() || undefined,
      name: formData.name.trim() || undefined,
      level: Number(formData.level),
      maxTeamMembers: formData.maxTeamMembers
        ? Number(formData.maxTeamMembers)
        : null,
      priceMonthly: formData.priceMonthly ? Number(formData.priceMonthly) : null,
      yearlyDiscountPercent: formData.yearlyDiscountPercent
        ? Number(formData.yearlyDiscountPercent)
        : null,
      features,
      isActive: formData.isActive,
    };
  };

  const handleSubmit = async (): Promise<void> => {
    const payload = buildPayload(!!editingTier);
    if (!payload) {
      return;
    }

    try {
      setActionLoading(true);
      if (editingTier) {
        await adminBillingApi.updateTier(editingTier.id, payload);
        toast.success("Tier updated successfully");
      } else {
        if (!payload.slug || !payload.name) {
          toast.error("Slug and name are required");
          return;
        }
        await adminBillingApi.createTier({
          slug: payload.slug,
          name: payload.name,
          level: payload.level ?? 0,
          maxTeamMembers: payload.maxTeamMembers ?? undefined,
          priceMonthly: payload.priceMonthly ?? undefined,
          yearlyDiscountPercent: payload.yearlyDiscountPercent ?? undefined,
          features: payload.features ?? undefined,
          isActive: payload.isActive ?? true,
        });
        toast.success("Tier created successfully");
      }
      setIsDialogOpen(false);
      resetForm();
      fetchTiers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save tier");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (tier: SubscriptionTierDTO): Promise<void> => {
    try {
      setActionLoading(true);
      await adminBillingApi.updateTier(tier.id, { isActive: !tier.isActive });
      toast.success(`Tier ${tier.isActive ? "disabled" : "enabled"}`);
      fetchTiers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to update tier");
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (tier: SubscriptionTierDTO): Promise<void> => {
    if (!confirm(`Delete tier "${tier.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      await adminBillingApi.deleteTier(tier.id);
      toast.success("Tier deleted successfully");
      fetchTiers();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Failed to delete tier");
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Tiers</CardTitle>
              <CardDescription>
                Manage plan names, levels, limits, and availability.
              </CardDescription>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Tier
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Team Limit</TableHead>
                <TableHead>Price Monthly</TableHead>
                <TableHead>Discount %</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-muted-foreground py-8"
                  >
                    No tiers found
                  </TableCell>
                </TableRow>
              ) : (
                tiers.map((tier) => (
                  <TableRow key={tier.id}>
                    <TableCell className="font-medium">{tier.name}</TableCell>
                    <TableCell className="font-mono text-sm">{tier.slug}</TableCell>
                    <TableCell>{tier.level}</TableCell>
                    <TableCell>{tier.maxTeamMembers ?? "-"}</TableCell>
                    <TableCell>{tier.priceMonthly ?? "-"}</TableCell>
                    <TableCell>{tier.yearlyDiscountPercent ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={tier.isActive ? "default" : "outline"}>
                        {tier.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(tier)}
                          disabled={actionLoading}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(tier)}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(tier)}
                          disabled={actionLoading}
                        >
                          {tier.isActive ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTier ? "Edit Tier" : "Create Tier"}</DialogTitle>
            <DialogDescription>
              Keep levels ordered from lowest to highest for access control.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tier-name">Name</Label>
              <Input
                id="tier-name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier-slug">Slug</Label>
              <Input
                id="tier-slug"
                value={formData.slug}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, slug: event.target.value }))
                }
                disabled={!!editingTier}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier-level">Level</Label>
              <Input
                id="tier-level"
                type="number"
                value={formData.level}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, level: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tier-team-limit">Max Team Members</Label>
                <Input
                  id="tier-team-limit"
                  type="number"
                  value={formData.maxTeamMembers}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      maxTeamMembers: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tier-price-monthly">Price Monthly</Label>
                <Input
                  id="tier-price-monthly"
                  type="number"
                  value={formData.priceMonthly}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      priceMonthly: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tier-discount">Yearly Discount %</Label>
                <Input
                  id="tier-discount"
                  type="number"
                  value={formData.yearlyDiscountPercent}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      yearlyDiscountPercent: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="tier-active"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                <Label htmlFor="tier-active">Active</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tier-features">Features (JSON)</Label>
              <Textarea
                id="tier-features"
                rows={6}
                value={formData.features}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, features: event.target.value }))
                }
                placeholder='{"storage":"10GB","support":"email"}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading}>
              {actionLoading ? "Saving..." : "Save Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

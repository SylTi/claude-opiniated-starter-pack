"use client";

import { useCallback, useEffect, useState } from "react";
import { adminDiscountCodesApi, ApiError } from "@/lib/api";
import type { DiscountCodeDTO } from "@saas/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminDiscountCodesPage(): React.ReactElement {
  const [discountCodes, setDiscountCodes] = useState<DiscountCodeDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCodeDTO | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discountType: "percent" as "percent" | "fixed",
    discountValue: "",
    currency: "usd",
    minAmount: "",
    maxUses: "",
    maxUsesPerTenant: "",
    expiresAt: "",
    isActive: true,
  });

  const fetchDiscountCodes = useCallback(async (): Promise<void> => {
    try {
      const data = await adminDiscountCodesApi.list();
      setDiscountCodes(data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDiscountCodes();
  }, [fetchDiscountCodes]);

  const resetForm = (): void => {
    setFormData({
      code: "",
      description: "",
      discountType: "percent",
      discountValue: "",
      currency: "usd",
      minAmount: "",
      maxUses: "",
      maxUsesPerTenant: "",
      expiresAt: "",
      isActive: true,
    });
    setEditingCode(null);
  };

  const openCreateDialog = (): void => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (code: DiscountCodeDTO): void => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      description: code.description || "",
      discountType: code.discountType,
      discountValue: String(code.discountValue),
      currency: code.currency || "usd",
      minAmount: code.minAmount ? String(code.minAmount) : "",
      maxUses: code.maxUses ? String(code.maxUses) : "",
      maxUsesPerTenant: code.maxUsesPerTenant
        ? String(code.maxUsesPerTenant)
        : "",
      expiresAt: code.expiresAt ? code.expiresAt.split("T")[0] : "",
      isActive: code.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (): Promise<void> => {
    try {
      setActionLoading(-1);
      const payload = {
        code: formData.code,
        description: formData.description || undefined,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        currency:
          formData.discountType === "fixed" ? formData.currency : undefined,
        minAmount: formData.minAmount ? Number(formData.minAmount) : undefined,
        maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
        maxUsesPerTenant: formData.maxUsesPerTenant
          ? Number(formData.maxUsesPerTenant)
          : undefined,
        expiresAt: formData.expiresAt || undefined,
        isActive: formData.isActive,
      };

      if (editingCode) {
        await adminDiscountCodesApi.update(editingCode.id, payload);
        toast.success("Discount code updated successfully");
      } else {
        await adminDiscountCodesApi.create(payload);
        toast.success("Discount code created successfully");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDiscountCodes();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!confirm("Are you sure you want to delete this discount code?")) {
      return;
    }

    try {
      setActionLoading(id);
      await adminDiscountCodesApi.delete(id);
      toast.success("Discount code deleted successfully");
      fetchDiscountCodes();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (code: DiscountCodeDTO): Promise<void> => {
    try {
      setActionLoading(code.id);
      await adminDiscountCodesApi.update(code.id, { isActive: !code.isActive });
      toast.success(`Discount code ${code.isActive ? "disabled" : "enabled"}`);
      fetchDiscountCodes();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  const formatDiscount = (code: DiscountCodeDTO): string => {
    if (code.discountType === "percent") {
      return `${code.discountValue}%`;
    }
    return `$${(code.discountValue / 100).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Discount Codes</h1>
          <p className="text-muted-foreground">
            Manage discount codes for subscriptions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Discount Code
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discountCodes.map((code) => (
            <TableRow key={code.id}>
              <TableCell>
                <div>
                  <span className="font-mono font-semibold">{code.code}</span>
                  {code.description && (
                    <p className="text-sm text-muted-foreground">{code.description}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatDiscount(code)}</Badge>
              </TableCell>
              <TableCell>
                {code.timesUsed}
                {code.maxUses !== null && ` / ${code.maxUses}`}
              </TableCell>
              <TableCell>{formatDate(code.expiresAt)}</TableCell>
              <TableCell>
                <Badge variant={code.isActive ? "default" : "secondary"}>
                  {code.isActive ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(code)}
                    disabled={actionLoading === code.id}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(code)}
                    disabled={actionLoading === code.id}
                  >
                    {actionLoading === code.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : code.isActive ? (
                      "Disable"
                    ) : (
                      "Enable"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(code.id)}
                    disabled={actionLoading === code.id}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {discountCodes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No discount codes found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCode ? "Edit Discount Code" : "Create Discount Code"}
            </DialogTitle>
            <DialogDescription>
              {editingCode
                ? "Update details for this discount code."
                : "Create a new discount code for subscriptions."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., SUMMER20"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discountType">Type</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(v: "percent" | "fixed") =>
                    setFormData({ ...formData, discountType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discountValue">
                  {formData.discountType === "percent"
                    ? "Percentage (%)"
                    : "Amount (cents)"}
                </Label>
                <Input
                  id="discountValue"
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, discountValue: e.target.value })
                  }
                  placeholder={
                    formData.discountType === "percent" ? "20" : "1000"
                  }
                />
              </div>
            </div>
            {formData.discountType === "fixed" && (
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(v) =>
                    setFormData({ ...formData, currency: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="maxUses">Max Uses (total)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  value={formData.maxUses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxUses: e.target.value })
                  }
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <Label htmlFor="maxUsesPerTenant">Max Uses (per tenant)</Label>
                <Input
                  id="maxUsesPerTenant"
                  type="number"
                  value={formData.maxUsesPerTenant}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxUsesPerTenant: e.target.value,
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="expiresAt">Expiration Date</Label>
              <Input
                id="expiresAt"
                type="date"
                value={formData.expiresAt}
                onChange={(e) =>
                  setFormData({ ...formData, expiresAt: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={actionLoading === -1}>
              {actionLoading === -1 && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingCode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

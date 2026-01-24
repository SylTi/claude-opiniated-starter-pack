"use client"

import { useCallback, useEffect, useState } from "react"
import {
  adminBillingApi,
  ApiError,
  type StripeProductDTO,
  type StripePriceDTO,
} from "@/lib/api"
import type { SubscriptionTierDTO } from "@saas/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  CreditCard,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

type ProductFormState = {
  tierId: string;
  providerProductId: string;
};

type PriceFormState = {
  productId: string;
  providerPriceId: string;
  interval: "month" | "year";
  currency: string;
  unitAmount: string;
  taxBehavior: "inclusive" | "exclusive";
  isActive: boolean;
};

const defaultProductForm: ProductFormState = {
  tierId: "",
  providerProductId: "",
}

const defaultPriceForm: PriceFormState = {
  productId: "",
  providerPriceId: "",
  interval: "month",
  currency: "usd",
  unitAmount: "",
  taxBehavior: "exclusive",
  isActive: true,
}

export default function AdminStripePage(): React.ReactElement {
  // Data state
  const [products, setProducts] = useState<StripeProductDTO[]>([])
  const [prices, setPrices] = useState<StripePriceDTO[]>([])
  const [tiers, setTiers] = useState<SubscriptionTierDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Product dialog state
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<StripeProductDTO | null>(
    null,
  )
  const [productForm, setProductForm] =
    useState<ProductFormState>(defaultProductForm)

  // Price dialog state
  const [isPriceDialogOpen, setIsPriceDialogOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState<StripePriceDTO | null>(null)
  const [priceForm, setPriceForm] = useState<PriceFormState>(defaultPriceForm)

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [productsData, pricesData, tiersData] = await Promise.all([
        adminBillingApi.listProducts(),
        adminBillingApi.listPrices() as Promise<StripePriceDTO[]>,
        adminBillingApi.listTiers(),
      ])
      setProducts(productsData)
      setPrices(pricesData)
      setTiers(tiersData)
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to fetch data")
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Product handlers
  const openCreateProductDialog = (): void => {
    setProductForm(defaultProductForm)
    setEditingProduct(null)
    setIsProductDialogOpen(true)
  }

  const openEditProductDialog = (product: StripeProductDTO): void => {
    setEditingProduct(product)
    setProductForm({
      tierId: String(product.tierId),
      providerProductId: product.providerProductId,
    })
    setIsProductDialogOpen(true)
  }

  const handleProductSubmit = async (): Promise<void> => {
    if (!productForm.tierId || !productForm.providerProductId.trim()) {
      toast.error("Tier and Stripe Product ID are required")
      return
    }

    try {
      setActionLoading(true)
      if (editingProduct) {
        await adminBillingApi.updateProduct(editingProduct.id, {
          providerProductId: productForm.providerProductId.trim(),
        })
        toast.success("Product updated successfully")
      } else {
        await adminBillingApi.createProduct({
          tierId: Number(productForm.tierId),
          provider: "stripe",
          providerProductId: productForm.providerProductId.trim(),
        })
        toast.success("Product created successfully")
      }
      setIsProductDialogOpen(false)
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to save product")
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteProduct = async (
    product: StripeProductDTO,
  ): Promise<void> => {
    const productPrices = prices.filter((p) => p.productId === product.id)
    if (productPrices.length > 0) {
      toast.error("Delete all prices for this product first")
      return
    }

    if (!confirm(`Delete product mapping for "${product.tier?.name}"?`)) {
      return
    }

    try {
      setActionLoading(true)
      await adminBillingApi.deleteProduct(product.id)
      toast.success("Product deleted successfully")
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to delete product")
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Price handlers
  const openCreatePriceDialog = (productId?: number): void => {
    setPriceForm({
      ...defaultPriceForm,
      productId: productId ? String(productId) : "",
    })
    setEditingPrice(null)
    setIsPriceDialogOpen(true)
  }

  const handlePriceSubmit = async (): Promise<void> => {
    if (
      !priceForm.productId ||
      !priceForm.providerPriceId.trim() ||
      !priceForm.unitAmount
    ) {
      toast.error("Product, Stripe Price ID, and amount are required")
      return
    }

    try {
      setActionLoading(true)
      if (editingPrice) {
        await adminBillingApi.updatePrice(editingPrice.id, {
          isActive: priceForm.isActive,
        })
        toast.success("Price updated successfully")
      } else {
        await adminBillingApi.createPrice({
          productId: Number(priceForm.productId),
          providerPriceId: priceForm.providerPriceId.trim(),
          interval: priceForm.interval,
          currency: priceForm.currency,
          unitAmount: Number(priceForm.unitAmount),
          taxBehavior: priceForm.taxBehavior,
          isActive: priceForm.isActive,
        })
        toast.success("Price created successfully")
      }
      setIsPriceDialogOpen(false)
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to save price")
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleTogglePriceActive = async (
    price: StripePriceDTO,
  ): Promise<void> => {
    try {
      setActionLoading(true)
      await adminBillingApi.updatePrice(price.id, {
        isActive: !price.isActive,
      })
      toast.success(`Price ${price.isActive ? "disabled" : "enabled"}`)
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to update price")
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePrice = async (price: StripePriceDTO): Promise<void> => {
    if (!confirm("Delete this price mapping?")) {
      return
    }

    try {
      setActionLoading(true)
      await adminBillingApi.deletePrice(price.id)
      toast.success("Price deleted successfully")
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error("Failed to delete price")
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Helpers
  const formatAmount = (amount: number, currency: string): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const getTierName = (tierId: number): string => {
    const tier = tiers.find((t) => t.id === tierId)
    return tier?.name ?? "Unknown"
  }

  const getProductName = (productId: number): string => {
    const product = products.find((p) => p.id === productId)
    return product?.tier?.name ?? "Unknown"
  }

  // Get tiers that don't have a product yet
  const availableTiers = tiers.filter(
    (t) => !products.some((p) => p.tierId === t.id) && t.slug !== "free",
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          Stripe Integration
        </h1>
        <p className="text-gray-500 mt-1">
          Link your local subscription tiers to Stripe products and prices
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>How it works</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>
              Create products and prices in your{" "}
              <a
                href="https://dashboard.stripe.com/products"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Stripe Dashboard
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Link each local tier to its Stripe product ID (prod_xxx)</li>
            <li>Add price mappings with Stripe price IDs (price_xxx)</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Products Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Products</CardTitle>
              <CardDescription>
                Map your local tiers to Stripe products (prod_xxx)
              </CardDescription>
            </div>
            <Button
              onClick={openCreateProductDialog}
              disabled={availableTiers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Link Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Local Tier</TableHead>
                <TableHead>Stripe Product ID</TableHead>
                <TableHead>Prices</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8"
                  >
                    No products linked yet. Create products in Stripe first,
                    then link them here.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => {
                  const productPrices = prices.filter(
                    (p) => p.productId === product.id,
                  )
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {product.tier?.name ?? "Unknown"}
                          </span>
                          <span className="text-sm text-muted-foreground ml-2">
                            ({product.tier?.slug})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {product.providerProductId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{productPrices.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCreatePriceDialog(product.id)}
                            disabled={actionLoading}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Price
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditProductDialog(product)}
                            disabled={actionLoading}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProduct(product)}
                            disabled={actionLoading}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Prices Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prices</CardTitle>
              <CardDescription>
                Map Stripe prices (price_xxx) to products. Each product can have
                multiple prices for different intervals/currencies.
              </CardDescription>
            </div>
            <Button
              onClick={() => openCreatePriceDialog()}
              disabled={products.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Price
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Stripe Price ID</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    {products.length === 0
                      ? "Link a product first before adding prices."
                      : "No prices configured yet."}
                  </TableCell>
                </TableRow>
              ) : (
                prices.map((price) => (
                  <TableRow key={price.id}>
                    <TableCell className="font-medium">
                      {getProductName(price.productId)}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {price.providerPriceId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{price.interval}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatAmount(price.unitAmount, price.currency)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {price.taxBehavior}
                    </TableCell>
                    <TableCell>
                      <Badge variant={price.isActive ? "default" : "outline"}>
                        {price.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTogglePriceActive(price)}
                          disabled={actionLoading}
                        >
                          {price.isActive ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePrice(price)}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
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

      {/* Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product Mapping" : "Link Stripe Product"}
            </DialogTitle>
            <DialogDescription>
              Connect a local subscription tier to a Stripe product.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-tier">Local Tier</Label>
              <Select
                value={productForm.tierId}
                onValueChange={(v) =>
                  setProductForm((prev) => ({ ...prev, tierId: v }))
                }
                disabled={!!editingProduct}
              >
                <SelectTrigger id="product-tier">
                  <SelectValue placeholder="Select a tier" />
                </SelectTrigger>
                <SelectContent>
                  {(editingProduct
                    ? tiers.filter((t) => t.id === editingProduct.tierId)
                    : availableTiers
                  ).map((tier) => (
                    <SelectItem key={tier.id} value={String(tier.id)}>
                      {tier.name} ({tier.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="product-stripe-id">Stripe Product ID</Label>
              <Input
                id="product-stripe-id"
                placeholder="prod_xxxxxxxxxxxxx"
                value={productForm.providerProductId}
                onChange={(e) =>
                  setProductForm((prev) => ({
                    ...prev,
                    providerProductId: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find this in your Stripe Dashboard → Products
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProductDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleProductSubmit} disabled={actionLoading}>
              {actionLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingProduct ? "Update" : "Link Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Dialog */}
      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? "Edit Price" : "Add Stripe Price"}
            </DialogTitle>
            <DialogDescription>
              Connect a Stripe price to a product.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="price-product">Product</Label>
              <Select
                value={priceForm.productId}
                onValueChange={(v) =>
                  setPriceForm((prev) => ({ ...prev, productId: v }))
                }
                disabled={!!editingPrice}
              >
                <SelectTrigger id="price-product">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.tier?.name ?? "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="price-stripe-id">Stripe Price ID</Label>
              <Input
                id="price-stripe-id"
                placeholder="price_xxxxxxxxxxxxx"
                value={priceForm.providerPriceId}
                onChange={(e) =>
                  setPriceForm((prev) => ({
                    ...prev,
                    providerPriceId: e.target.value,
                  }))
                }
                disabled={!!editingPrice}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price-interval">Interval</Label>
                <Select
                  value={priceForm.interval}
                  onValueChange={(v) =>
                    setPriceForm((prev) => ({
                      ...prev,
                      interval: v as "month" | "year",
                    }))
                  }
                  disabled={!!editingPrice}
                >
                  <SelectTrigger id="price-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="price-currency">Currency</Label>
                <Select
                  value={priceForm.currency}
                  onValueChange={(v) =>
                    setPriceForm((prev) => ({ ...prev, currency: v }))
                  }
                  disabled={!!editingPrice}
                >
                  <SelectTrigger id="price-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usd">USD</SelectItem>
                    <SelectItem value="eur">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price-amount">Amount (cents)</Label>
                <Input
                  id="price-amount"
                  type="number"
                  placeholder="1999"
                  value={priceForm.unitAmount}
                  onChange={(e) =>
                    setPriceForm((prev) => ({
                      ...prev,
                      unitAmount: e.target.value,
                    }))
                  }
                  disabled={!!editingPrice}
                />
              </div>
              <div>
                <Label htmlFor="price-tax">Tax Behavior</Label>
                <Select
                  value={priceForm.taxBehavior}
                  onValueChange={(v) =>
                    setPriceForm((prev) => ({
                      ...prev,
                      taxBehavior: v as "inclusive" | "exclusive",
                    }))
                  }
                  disabled={!!editingPrice}
                >
                  <SelectTrigger id="price-tax">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exclusive">Exclusive</SelectItem>
                    <SelectItem value="inclusive">Inclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="price-active"
                type="checkbox"
                checked={priceForm.isActive}
                onChange={(e) =>
                  setPriceForm((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
              />
              <Label htmlFor="price-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPriceDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button onClick={handlePriceSubmit} disabled={actionLoading}>
              {actionLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPrice ? "Update" : "Add Price"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

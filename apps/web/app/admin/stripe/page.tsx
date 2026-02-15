"use client"

import { useCallback, useEffect, useState } from "react"
import {
  adminBillingApi,
  ApiError,
  type StripeProductDTO,
  type StripePriceDTO,
} from "@/lib/api"
import { useI18n } from "@/contexts/i18n-context"
import type { SubscriptionTierDTO } from "@saas/shared"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@saas/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@saas/ui/card"
import { Button } from "@saas/ui/button"
import { Badge } from "@saas/ui/badge"
import { Input } from "@saas/ui/input"
import { Label } from "@saas/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@saas/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@saas/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@saas/ui/alert"
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
  const { locale, t } = useI18n("skeleton")
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
        toast.error(t("adminStripe.fetchError"))
      }
    } finally {
      setIsLoading(false)
    }
  }, [t])

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
      toast.error(t("adminStripe.productRequiredError"))
      return
    }

    try {
      setActionLoading(true)
      if (editingProduct) {
        await adminBillingApi.updateProduct(editingProduct.id, {
          providerProductId: productForm.providerProductId.trim(),
        })
        toast.success(t("adminStripe.productUpdateSuccess"))
      } else {
        await adminBillingApi.createProduct({
          tierId: Number(productForm.tierId),
          provider: "stripe",
          providerProductId: productForm.providerProductId.trim(),
        })
        toast.success(t("adminStripe.productCreateSuccess"))
      }
      setIsProductDialogOpen(false)
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminStripe.productSaveError"))
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
      toast.error(t("adminStripe.deletePricesFirst"))
      return
    }

    if (!confirm(t("adminStripe.confirmDeleteProduct", { name: product.tier?.name ?? "" }))) {
      return
    }

    try {
      setActionLoading(true)
      await adminBillingApi.deleteProduct(product.id)
      toast.success(t("adminStripe.productDeleteSuccess"))
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminStripe.productDeleteError"))
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
      toast.error(t("adminStripe.priceRequiredError"))
      return
    }

    try {
      setActionLoading(true)
      if (editingPrice) {
        await adminBillingApi.updatePrice(editingPrice.id, {
          isActive: priceForm.isActive,
        })
        toast.success(t("adminStripe.priceUpdateSuccess"))
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
        toast.success(t("adminStripe.priceCreateSuccess"))
      }
      setIsPriceDialogOpen(false)
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminStripe.priceSaveError"))
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
      toast.success(
        t(price.isActive ? "adminStripe.priceDisabledSuccess" : "adminStripe.priceEnabledSuccess")
      )
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminStripe.priceUpdateError"))
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeletePrice = async (price: StripePriceDTO): Promise<void> => {
    if (!confirm(t("adminStripe.confirmDeletePrice"))) {
      return
    }

    try {
      setActionLoading(true)
      await adminBillingApi.deletePrice(price.id)
      toast.success(t("adminStripe.priceDeleteSuccess"))
      fetchData()
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message)
      } else {
        toast.error(t("adminStripe.priceDeleteError"))
      }
    } finally {
      setActionLoading(false)
    }
  }

  // Helpers
  const formatAmount = (amount: number, currency: string): string => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  const getProductName = (productId: number): string => {
    const product = products.find((p) => p.id === productId)
    return product?.tier?.name ?? t("adminStripe.unknown")
  }

  // Get tiers that don't have a product yet
  const availableTiers = tiers.filter(
    (t) => !products.some((p) => p.tierId === t.id) && t.slug !== "free",
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6" />
          {t("adminStripe.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("adminStripe.subtitle")}
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t("adminStripe.howItWorksTitle")}</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
            <li>
              {t("adminStripe.stepCreateInStripePrefix")}{" "}
              <a
                href="https://dashboard.stripe.com/products"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {t("adminStripe.stripeDashboard")}
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>{t("adminStripe.stepLinkTier")}</li>
            <li>{t("adminStripe.stepAddPrices")}</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Products Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("adminStripe.productsTitle")}</CardTitle>
              <CardDescription>
                {t("adminStripe.productsDescription")}
              </CardDescription>
            </div>
            <Button
              onClick={openCreateProductDialog}
              disabled={availableTiers.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("adminStripe.linkProduct")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminStripe.tableLocalTier")}</TableHead>
                <TableHead>{t("adminStripe.tableStripeProductId")}</TableHead>
                <TableHead>{t("adminStripe.tablePrices")}</TableHead>
                <TableHead className="text-right">{t("adminStripe.tableActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8"
                  >
                    {t("adminStripe.noProducts")}
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
                            {product.tier?.name ?? t("adminStripe.unknown")}
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
                            {t("adminStripe.addPrice")}
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
              <CardTitle>{t("adminStripe.pricesTitle")}</CardTitle>
              <CardDescription>
                {t("adminStripe.pricesDescription")}
              </CardDescription>
            </div>
            <Button
              onClick={() => openCreatePriceDialog()}
              disabled={products.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("adminStripe.addPrice")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("adminStripe.tableProduct")}</TableHead>
                <TableHead>{t("adminStripe.tableStripePriceId")}</TableHead>
                <TableHead>{t("adminStripe.tableInterval")}</TableHead>
                <TableHead>{t("adminStripe.tableAmount")}</TableHead>
                <TableHead>{t("adminStripe.tableTax")}</TableHead>
                <TableHead>{t("adminStripe.tableStatus")}</TableHead>
                <TableHead className="text-right">{t("adminStripe.tableActions")}</TableHead>
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
                      ? t("adminStripe.linkProductFirst")
                      : t("adminStripe.noPrices")}
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
                        {price.isActive ? t("adminStripe.active") : t("adminStripe.inactive")}
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
                          {price.isActive ? t("adminStripe.disable") : t("adminStripe.enable")}
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
              {editingProduct ? t("adminStripe.editProductMapping") : t("adminStripe.linkStripeProduct")}
            </DialogTitle>
            <DialogDescription>
              {t("adminStripe.productDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-tier">{t("adminStripe.fieldLocalTier")}</Label>
              <Select
                value={productForm.tierId}
                onValueChange={(v) =>
                  setProductForm((prev) => ({ ...prev, tierId: v }))
                }
                disabled={!!editingProduct}
              >
                <SelectTrigger id="product-tier">
                  <SelectValue placeholder={t("adminStripe.selectTier")} />
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
              <Label htmlFor="product-stripe-id">{t("adminStripe.fieldStripeProductId")}</Label>
              <Input
                id="product-stripe-id"
                placeholder={t("adminStripe.productIdPlaceholder")}
                value={productForm.providerProductId}
                onChange={(e) =>
                  setProductForm((prev) => ({
                    ...prev,
                    providerProductId: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("adminStripe.findInStripeProducts")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsProductDialogOpen(false)}
              disabled={actionLoading}
            >
              {t("adminStripe.cancel")}
            </Button>
            <Button onClick={handleProductSubmit} disabled={actionLoading}>
              {actionLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingProduct ? t("adminStripe.update") : t("adminStripe.linkProduct")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Dialog */}
      <Dialog open={isPriceDialogOpen} onOpenChange={setIsPriceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPrice ? t("adminStripe.editPrice") : t("adminStripe.addStripePrice")}
            </DialogTitle>
            <DialogDescription>
              {t("adminStripe.priceDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="price-product">{t("adminStripe.fieldProduct")}</Label>
              <Select
                value={priceForm.productId}
                onValueChange={(v) =>
                  setPriceForm((prev) => ({ ...prev, productId: v }))
                }
                disabled={!!editingPrice}
              >
                <SelectTrigger id="price-product">
                  <SelectValue placeholder={t("adminStripe.selectProduct")} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.tier?.name ?? t("adminStripe.unknown")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="price-stripe-id">{t("adminStripe.fieldStripePriceId")}</Label>
              <Input
                id="price-stripe-id"
                placeholder={t("adminStripe.priceIdPlaceholder")}
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
                <Label htmlFor="price-interval">{t("adminStripe.fieldInterval")}</Label>
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
                    <SelectItem value="month">{t("adminStripe.monthly")}</SelectItem>
                    <SelectItem value="year">{t("adminStripe.yearly")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="price-currency">{t("adminStripe.fieldCurrency")}</Label>
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
                    <SelectItem value="usd">{t("common.currency.usd")}</SelectItem>
                    <SelectItem value="eur">{t("common.currency.eur")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price-amount">{t("adminStripe.fieldAmountCents")}</Label>
                <Input
                  id="price-amount"
                  type="number"
                  placeholder={t("adminStripe.amountPlaceholder")}
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
                <Label htmlFor="price-tax">{t("adminStripe.fieldTaxBehavior")}</Label>
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
                    <SelectItem value="exclusive">{t("adminStripe.taxExclusive")}</SelectItem>
                    <SelectItem value="inclusive">{t("adminStripe.taxInclusive")}</SelectItem>
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
              <Label htmlFor="price-active">{t("adminStripe.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPriceDialogOpen(false)}
              disabled={actionLoading}
            >
              {t("adminStripe.cancel")}
            </Button>
            <Button onClick={handlePriceSubmit} disabled={actionLoading}>
              {actionLoading && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPrice ? t("adminStripe.update") : t("adminStripe.addPrice")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

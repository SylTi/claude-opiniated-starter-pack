import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminStripePage from "@/app/admin/stripe/page";
import type { SubscriptionTierDTO } from "@saas/shared";
import type { StripeProductDTO, StripePriceDTO } from "@/lib/api";

const mockListProducts = vi.fn();
const mockListPrices = vi.fn();
const mockListTiers = vi.fn();
const mockCreateProduct = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockCreatePrice = vi.fn();
const mockUpdatePrice = vi.fn();
const mockDeletePrice = vi.fn();

vi.mock("@/lib/api", () => ({
  adminBillingApi: {
    listProducts: (...args: unknown[]) => mockListProducts(...args),
    listPrices: (...args: unknown[]) => mockListPrices(...args),
    listTiers: (...args: unknown[]) => mockListTiers(...args),
    createProduct: (...args: unknown[]) => mockCreateProduct(...args),
    updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
    deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
    createPrice: (...args: unknown[]) => mockCreatePrice(...args),
    updatePrice: (...args: unknown[]) => mockUpdatePrice(...args),
    deletePrice: (...args: unknown[]) => mockDeletePrice(...args),
  },
  ApiError: class ApiError extends Error {
    statusCode: number;
    error: string;
    constructor(statusCode: number, error: string, message: string) {
      super(message);
      this.statusCode = statusCode;
      this.error = error;
    }
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTiers: SubscriptionTierDTO[] = [
  {
    id: 1,
    slug: "free",
    name: "Free",
    description: null,
    level: 0,
    maxTeamMembers: 1,
    priceMonthly: null,
    yearlyDiscountPercent: 0,
    features: null,
    isActive: true,
  },
  {
    id: 2,
    slug: "pro",
    name: "Pro",
    description: null,
    level: 1,
    maxTeamMembers: 5,
    priceMonthly: 999,
    yearlyDiscountPercent: 20,
    features: null,
    isActive: true,
  },
];

const mockProducts: StripeProductDTO[] = [
  {
    id: 1,
    tierId: 2,
    provider: "stripe",
    providerProductId: "prod_abc123",
    tier: { id: 2, name: "Pro", slug: "pro" },
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null,
  },
];

const mockPrices: StripePriceDTO[] = [
  {
    id: 1,
    productId: 1,
    provider: "stripe",
    providerPriceId: "price_monthly123",
    interval: "month",
    currency: "usd",
    unitAmount: 1999,
    taxBehavior: "exclusive",
    isActive: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null,
  },
  {
    id: 2,
    productId: 1,
    provider: "stripe",
    providerPriceId: "price_yearly123",
    interval: "year",
    currency: "usd",
    unitAmount: 19990,
    taxBehavior: "exclusive",
    isActive: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: null,
  },
];

describe("Admin Stripe Integration Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTiers.mockResolvedValue(mockTiers);
    mockListProducts.mockResolvedValue(mockProducts);
    mockListPrices.mockResolvedValue(mockPrices);
  });

  it("renders the page title and description", async () => {
    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Stripe Integration")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Link your local subscription tiers to Stripe/i),
    ).toBeInTheDocument();
  });

  it("renders how it works instructions", async () => {
    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("How it works")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Create products and prices in your/i),
    ).toBeInTheDocument();
  });

  it("renders products section with linked products", async () => {
    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    // "Pro" appears in both products and prices tables
    const proElements = screen.getAllByText("Pro");
    expect(proElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("prod_abc123")).toBeInTheDocument();
  });

  it("renders prices section with configured prices", async () => {
    render(<AdminStripePage />);

    await waitFor(() => {
      // "Prices" appears as table header and card title
      const pricesElements = screen.getAllByText("Prices");
      expect(pricesElements.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText("price_monthly123")).toBeInTheDocument();
    expect(screen.getByText("price_yearly123")).toBeInTheDocument();
    expect(screen.getByText("$19.99")).toBeInTheDocument();
  });

  it("shows empty state when no products linked", async () => {
    mockListProducts.mockResolvedValue([]);
    mockListPrices.mockResolvedValue([]);

    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText(/No products linked yet/i)).toBeInTheDocument();
    });
  });

  it("opens create product dialog", async () => {
    const user = userEvent.setup();
    // Remove existing products so Pro tier is available for linking
    mockListProducts.mockResolvedValue([]);

    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /link product/i }));

    expect(screen.getByText("Link Stripe Product")).toBeInTheDocument();
    expect(
      screen.getByText(/Connect a local subscription tier/i),
    ).toBeInTheDocument();
  });

  it("creates a new product mapping", async () => {
    const user = userEvent.setup();
    mockCreateProduct.mockResolvedValue({
      id: 2,
      tierId: 2,
      provider: "stripe",
      providerProductId: "prod_new123",
      tier: { id: 2, name: "Pro", slug: "pro" },
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: null,
    });
    // Remove existing product so Pro tier is available
    mockListProducts.mockResolvedValue([]);

    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /link product/i }));

    // Select tier
    const tierSelect = screen.getByRole("combobox", { name: /local tier/i });
    await user.click(tierSelect);
    await user.click(screen.getByRole("option", { name: /Pro/i }));

    // Enter Stripe product ID
    await user.type(
      screen.getByPlaceholderText("prod_xxxxxxxxxxxxx"),
      "prod_new123",
    );

    await user.click(screen.getByRole("button", { name: /link product/i }));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        tierId: 2,
        provider: "stripe",
        providerProductId: "prod_new123",
      });
    });
  });

  it("opens add price dialog from product row", async () => {
    const user = userEvent.setup();
    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    // There are multiple "Add Price" buttons - one per product row, one in Prices section
    const addPriceButtons = screen.getAllByRole("button", {
      name: /add price/i,
    });
    await user.click(addPriceButtons[0]);

    expect(screen.getByText("Add Stripe Price")).toBeInTheDocument();
  });

  it("creates a new price", async () => {
    const user = userEvent.setup();
    mockCreatePrice.mockResolvedValue({
      id: 3,
      productId: 1,
      provider: "stripe",
      providerPriceId: "price_eur_monthly",
      interval: "month",
      currency: "eur",
      unitAmount: 1899,
      taxBehavior: "exclusive",
      isActive: true,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: null,
    });

    render(<AdminStripePage />);

    await waitFor(() => {
      // "Prices" appears as table header and card title
      const pricesElements = screen.getAllByText("Prices");
      expect(pricesElements.length).toBeGreaterThanOrEqual(1);
    });

    // Click the "Add Price" button in the prices section
    const addPriceButtons = screen.getAllByRole("button", {
      name: /add price/i,
    });
    await user.click(addPriceButtons[addPriceButtons.length - 1]);

    // Select product
    const productSelect = screen.getByRole("combobox", { name: /product/i });
    await user.click(productSelect);
    await user.click(screen.getByRole("option", { name: /Pro/i }));

    // Enter Stripe price ID
    await user.type(
      screen.getByPlaceholderText("price_xxxxxxxxxxxxx"),
      "price_eur_monthly",
    );

    // Select currency
    const currencySelect = screen.getByRole("combobox", { name: /currency/i });
    await user.click(currencySelect);
    await user.click(screen.getByRole("option", { name: /EUR/i }));

    // Enter amount
    await user.type(screen.getByPlaceholderText("1999"), "1899");

    await user.click(screen.getByRole("button", { name: /^add price$/i }));

    await waitFor(() => {
      expect(mockCreatePrice).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 1,
          providerPriceId: "price_eur_monthly",
          currency: "eur",
          unitAmount: 1899,
        }),
      );
    });
  });

  it("toggles price active status", async () => {
    const user = userEvent.setup();
    mockUpdatePrice.mockResolvedValue({ ...mockPrices[0], isActive: false });

    render(<AdminStripePage />);

    await waitFor(() => {
      // "Prices" appears as table header and card title
      const pricesElements = screen.getAllByText("Prices");
      expect(pricesElements.length).toBeGreaterThanOrEqual(1);
    });

    // Find and click first "Disable" button (for active price)
    const disableButtons = screen.getAllByRole("button", { name: /disable/i });
    await user.click(disableButtons[0]);

    await waitFor(() => {
      expect(mockUpdatePrice).toHaveBeenCalledWith(1, { isActive: false });
    });
  });

  it("deletes a price after confirmation", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    mockDeletePrice.mockResolvedValue({});

    render(<AdminStripePage />);

    await waitFor(() => {
      // "Prices" appears as table header and card title
      const pricesElements = screen.getAllByText("Prices");
      expect(pricesElements.length).toBeGreaterThanOrEqual(1);
    });

    // Find the specific price IDs in the table (not placeholders)
    expect(screen.getByText("price_monthly123")).toBeInTheDocument();
    expect(screen.getByText("price_yearly123")).toBeInTheDocument();

    // Click delete on first price row
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector(".text-red-500"));
    await user.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(mockDeletePrice).toHaveBeenCalled();
    });

    vi.unstubAllGlobals();
  });

  it("prevents deleting product with prices", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    // Find product row delete button
    const productTable = screen
      .getByText("Products")
      .closest("div")?.parentElement;
    const deleteButton = productTable?.querySelector(
      "button[class*='text-red']",
    );

    if (deleteButton) {
      await user.click(deleteButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Delete all prices for this product first",
        );
      });
    }
  });

  it("deletes a product after confirmation when no prices", async () => {
    const user = userEvent.setup();
    mockListPrices.mockResolvedValue([]);
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    mockDeleteProduct.mockResolvedValue({});

    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    // Find and click delete button in products section
    const deleteButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.querySelector(".text-red-500"));
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteProduct).toHaveBeenCalledWith(1);
    });

    vi.unstubAllGlobals();
  });

  it("shows loading state", () => {
    mockListProducts.mockReturnValue(new Promise(() => {}));
    mockListPrices.mockReturnValue(new Promise(() => {}));
    mockListTiers.mockReturnValue(new Promise(() => {}));

    render(<AdminStripePage />);

    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("displays price count badge on product rows", async () => {
    render(<AdminStripePage />);

    await waitFor(() => {
      expect(screen.getByText("Products")).toBeInTheDocument();
    });

    // Product should show badge with "2" (two prices linked)
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows active/inactive status for prices", async () => {
    render(<AdminStripePage />);

    await waitFor(() => {
      // "Prices" appears as table header and card title
      const pricesElements = screen.getAllByText("Prices");
      expect(pricesElements.length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});

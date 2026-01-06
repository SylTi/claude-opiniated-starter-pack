import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminTiersPage from "@/app/admin/tiers/page";
import type { SubscriptionTierDTO } from "@saas/shared";

const mockListTiers = vi.fn();
const mockCreateTier = vi.fn();
const mockUpdateTier = vi.fn();
const mockDeleteTier = vi.fn();

vi.mock("@/lib/api", () => ({
  adminBillingApi: {
    listTiers: (...args: unknown[]) => mockListTiers(...args),
    createTier: (...args: unknown[]) => mockCreateTier(...args),
    updateTier: (...args: unknown[]) => mockUpdateTier(...args),
    deleteTier: (...args: unknown[]) => mockDeleteTier(...args),
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
    features: { support: "community" },
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
    features: { support: "email" },
    isActive: false,
  },
];

describe("Admin Tiers Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTiers.mockResolvedValue(mockTiers);
    mockDeleteTier.mockResolvedValue({});
  });

  it("renders tiers table", async () => {
    render(<AdminTiersPage />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Tiers")).toBeInTheDocument();
    });

    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("pro")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("creates a tier from the dialog", async () => {
    const user = userEvent.setup();
    mockCreateTier.mockResolvedValue({
      ...mockTiers[0],
      id: 3,
      slug: "enterprise",
      name: "Enterprise",
      level: 2,
      isActive: true,
    });

    render(<AdminTiersPage />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Tiers")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /new tier/i }));

    await user.type(screen.getByLabelText("Name"), "Enterprise");
    await user.type(screen.getByLabelText("Slug"), "enterprise");
    await user.type(screen.getByLabelText("Level"), "2");
    await user.type(screen.getByLabelText("Max Team Members"), "10");
    await user.type(screen.getByLabelText("Price Monthly"), "4999");
    await user.type(screen.getByLabelText("Yearly Discount %"), "10");
    fireEvent.change(screen.getByLabelText("Features (JSON)"), {
      target: { value: '{"support":"priority"}' },
    });

    await user.click(screen.getByRole("button", { name: /save tier/i }));

    await waitFor(() => {
      expect(mockCreateTier).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "enterprise",
          name: "Enterprise",
          level: 2,
          maxTeamMembers: 10,
          priceMonthly: 4999,
          yearlyDiscountPercent: 10,
          features: { support: "priority" },
          isActive: true,
        })
      );
    });
  });

  it("updates a tier from the dialog", async () => {
    const user = userEvent.setup();
    mockUpdateTier.mockResolvedValue({
      ...mockTiers[1],
      name: "Pro Plus",
    });

    render(<AdminTiersPage />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Tiers")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    await user.click(editButtons[1]);

    const nameInput = screen.getByLabelText("Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Pro Plus");

    await user.click(screen.getByRole("button", { name: /save tier/i }));

    await waitFor(() => {
      expect(mockUpdateTier).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ name: "Pro Plus" })
      );
    });
  });

  it("deletes a tier after confirmation", async () => {
    const user = userEvent.setup();
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<AdminTiersPage />);

    await waitFor(() => {
      expect(screen.getByText("Subscription Tiers")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteTier).toHaveBeenCalledWith(1);
    });

    vi.unstubAllGlobals();
  });
});

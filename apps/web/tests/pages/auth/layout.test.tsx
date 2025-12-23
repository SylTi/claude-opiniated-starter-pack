import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLayout from "@/app/(auth)/layout";

describe("Auth Layout", () => {
  it("renders children correctly", () => {
    render(
      <AuthLayout>
        <div data-testid="child-content">Child Content</div>
      </AuthLayout>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });

  it("applies centered layout classes", () => {
    const { container } = render(
      <AuthLayout>
        <div>Test</div>
      </AuthLayout>
    );

    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass("min-h-[calc(100vh-4rem)]");
    expect(outerDiv).toHaveClass("flex");
    expect(outerDiv).toHaveClass("items-center");
    expect(outerDiv).toHaveClass("justify-center");
    expect(outerDiv).toHaveClass("bg-gray-50");
  });

  it("contains a max-width container for content", () => {
    const { container } = render(
      <AuthLayout>
        <div>Test</div>
      </AuthLayout>
    );

    const innerDiv = container.firstChild?.firstChild as HTMLElement;
    expect(innerDiv).toHaveClass("max-w-md");
    expect(innerDiv).toHaveClass("w-full");
    expect(innerDiv).toHaveClass("space-y-8");
  });
});

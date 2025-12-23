import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

describe("Home Page", () => {
  describe("rendering", () => {
    it("renders main heading", () => {
      render(<Home />);

      expect(screen.getByText("SaaS Monorepo Starter")).toBeInTheDocument();
    });

    it("renders description text", () => {
      render(<Home />);

      expect(
        screen.getByText(
          "A production-ready monorepo setup with Next.js, AdonisJS, and TypeScript."
        )
      ).toBeInTheDocument();
    });

    it("renders View Dashboard button", () => {
      render(<Home />);

      expect(
        screen.getByRole("link", { name: /view dashboard/i })
      ).toBeInTheDocument();
    });

    it("has correct dashboard link href", () => {
      render(<Home />);

      expect(
        screen.getByRole("link", { name: /view dashboard/i })
      ).toHaveAttribute("href", "/dashboard");
    });

    it("renders GitHub button", () => {
      render(<Home />);

      expect(screen.getByRole("link", { name: /github/i })).toBeInTheDocument();
    });

    it("GitHub link opens in new tab", () => {
      render(<Home />);

      const githubLink = screen.getByRole("link", { name: /github/i });
      expect(githubLink).toHaveAttribute("target", "_blank");
      expect(githubLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  describe("feature cards", () => {
    it("renders Next.js Frontend card", () => {
      render(<Home />);

      expect(screen.getByText("Next.js Frontend")).toBeInTheDocument();
      expect(
        screen.getByText("App Router with TypeScript")
      ).toBeInTheDocument();
    });

    it("renders AdonisJS Backend card", () => {
      render(<Home />);

      expect(screen.getByText("AdonisJS Backend")).toBeInTheDocument();
      expect(
        screen.getByText("TypeScript-first Node.js framework")
      ).toBeInTheDocument();
    });

    it("renders Shared Types card", () => {
      render(<Home />);

      expect(screen.getByText("Shared Types")).toBeInTheDocument();
      expect(screen.getByText("End-to-end type safety")).toBeInTheDocument();
    });

    it("renders Next.js description", () => {
      render(<Home />);

      expect(
        screen.getByText(
          "Modern React framework with server components and optimized routing."
        )
      ).toBeInTheDocument();
    });

    it("renders AdonisJS description", () => {
      render(<Home />);

      expect(
        screen.getByText(
          "Full-featured MVC framework with Lucid ORM and built-in authentication."
        )
      ).toBeInTheDocument();
    });

    it("renders Shared Types description", () => {
      render(<Home />);

      expect(
        screen.getByText(
          "Shared TypeScript types between frontend and backend for consistency."
        )
      ).toBeInTheDocument();
    });
  });
});

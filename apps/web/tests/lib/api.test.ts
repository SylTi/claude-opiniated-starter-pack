import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "@/lib/api";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("api client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("api.get", () => {
    it("makes GET request to correct URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 1 } }),
      });

      await api.get("/api/v1/users");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3333/api/v1/users",
        expect.objectContaining({
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })
      );
    });

    it("returns data on success", async () => {
      const mockData = { id: 1, name: "Test" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockData }),
      });

      const result = await api.get("/api/v1/users/1");

      expect(result).toEqual({ data: mockData });
    });

    it("throws ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: "NotFound",
          message: "User not found",
        }),
      });

      await expect(api.get("/api/v1/users/999")).rejects.toThrow(ApiError);
    });

    it("includes error details in ApiError", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: "ValidationError",
          message: "Validation failed",
          errors: [{ field: "email", message: "Invalid email", rule: "email" }],
        }),
      });

      try {
        await api.get("/api/v1/users");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        const apiError = error as ApiError;
        expect(apiError.statusCode).toBe(400);
        expect(apiError.error).toBe("ValidationError");
        expect(apiError.message).toBe("Validation failed");
        expect(apiError.errors).toHaveLength(1);
        expect(apiError.errors?.[0].field).toBe("email");
      }
    });
  });

  describe("api.post", () => {
    it("makes POST request with body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 1 } }),
      });

      const body = { email: "test@example.com", password: "password" };
      await api.post("/api/v1/auth/login", body);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3333/api/v1/auth/login",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
      );
    });

    it("makes POST request without body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Success" }),
      });

      await api.post("/api/v1/auth/logout");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3333/api/v1/auth/logout",
        expect.objectContaining({
          method: "POST",
          body: undefined,
        })
      );
    });

    it("returns data on success", async () => {
      const mockResponse = { data: { id: 1 }, message: "Created" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.post("/api/v1/users", { name: "Test" });

      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: "ValidationError",
          message: "Invalid data",
        }),
      });

      await expect(
        api.post("/api/v1/users", { name: "" })
      ).rejects.toThrow(ApiError);
    });
  });

  describe("api.put", () => {
    it("makes PUT request with body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { id: 1 } }),
      });

      const body = { name: "Updated Name" };
      await api.put("/api/v1/users/1", body);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3333/api/v1/users/1",
        expect.objectContaining({
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })
      );
    });

    it("makes PUT request without body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Updated" }),
      });

      await api.put("/api/v1/users/1/activate");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3333/api/v1/users/1/activate",
        expect.objectContaining({
          method: "PUT",
          body: undefined,
        })
      );
    });

    it("returns data on success", async () => {
      const mockResponse = { data: { id: 1, name: "Updated" } };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.put("/api/v1/users/1", { name: "Updated" });

      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          error: "NotFound",
          message: "User not found",
        }),
      });

      await expect(
        api.put("/api/v1/users/999", { name: "Test" })
      ).rejects.toThrow(ApiError);
    });
  });

  describe("api.delete", () => {
    it("makes DELETE request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Deleted" }),
      });

      await api.delete("/api/v1/users/1");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3333/api/v1/users/1",
        expect.objectContaining({
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        })
      );
    });

    it("returns data on success", async () => {
      const mockResponse = { message: "User deleted" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await api.delete("/api/v1/users/1");

      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: "Forbidden",
          message: "Not authorized",
        }),
      });

      await expect(api.delete("/api/v1/users/1")).rejects.toThrow(ApiError);
    });
  });
});

describe("ApiError", () => {
  it("is an instance of Error", () => {
    const error = new ApiError(400, "ValidationError", "Invalid data");
    expect(error).toBeInstanceOf(Error);
  });

  it("has correct properties", () => {
    const errors = [{ field: "email", message: "Invalid", rule: "email" }];
    const error = new ApiError(422, "ValidationError", "Validation failed", errors);

    expect(error.statusCode).toBe(422);
    expect(error.error).toBe("ValidationError");
    expect(error.message).toBe("Validation failed");
    expect(error.errors).toEqual(errors);
    expect(error.name).toBe("ApiError");
  });

  it("handles missing errors array", () => {
    const error = new ApiError(500, "ServerError", "Internal error");

    expect(error.statusCode).toBe(500);
    expect(error.errors).toBeUndefined();
  });
});

describe("handleResponse (via api methods)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles missing error field in response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        message: "Something went wrong",
      }),
    });

    try {
      await api.get("/api/v1/test");
      expect.fail("Should have thrown");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.error).toBe("UnknownError");
      expect(apiError.message).toBe("Something went wrong");
    }
  });

  it("handles missing message field in response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: "ServerError",
      }),
    });

    try {
      await api.get("/api/v1/test");
      expect.fail("Should have thrown");
    } catch (error) {
      const apiError = error as ApiError;
      expect(apiError.error).toBe("ServerError");
      expect(apiError.message).toBe("An error occurred");
    }
  });
});

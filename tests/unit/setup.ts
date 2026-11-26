import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// `server-only` lança erro fora do ambiente React Server; nos testes, é inerte.
vi.mock("server-only", () => ({}));

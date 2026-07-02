/**
 * Global test setup. Registers jest-dom's DOM matchers (toBeInTheDocument,
 * toHaveClass, …) for the jsdom-environment component/hook tests. Importing this
 * in a node-environment test is harmless — it only extends `expect`, and pure
 * tests simply never call the DOM matchers.
 */
import "@testing-library/jest-dom/vitest";

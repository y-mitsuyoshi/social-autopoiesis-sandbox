import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

// Mock the API client
vi.mock("../api/client", () => ({
  startSimulation: vi.fn(),
  fetchSimulationLogs: vi.fn(),
  openSimulationSocket: vi.fn(),
}));

describe("App Integration Tests", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders the main app elements", () => {
    render(<App />);
    expect(screen.getByText("AUTOPOIESIS HUMAN AVATAR DASHBOARD")).toBeInTheDocument();
    
    // Check for the THEORY GUIDE button next to status indicators
    const theoryBtn = screen.getByTestId("theory-guide-btn");
    expect(theoryBtn).toBeInTheDocument();
    expect(theoryBtn.textContent).toBe("THEORY GUIDE");
  });

  it("toggles the educational panel when theory guide button and close button are clicked", () => {
    render(<App />);
    
    // Educational panel should be closed initially
    expect(screen.queryByTestId("educational-panel")).not.toBeInTheDocument();

    // Click Theory Guide button
    const theoryBtn = screen.getByTestId("theory-guide-btn");
    fireEvent.click(theoryBtn);

    // Now it should be open
    expect(screen.getByTestId("educational-panel")).toBeInTheDocument();

    // Click Close button inside the educational panel
    const closeBtn = screen.getByTestId("close-panel-btn");
    fireEvent.click(closeBtn);

    // It should be closed again
    expect(screen.queryByTestId("educational-panel")).not.toBeInTheDocument();
  });

  it("renders BinaryCodeGauge when messages are loaded", async () => {
    const { fetchSimulationLogs } = await import("../api/client");
    const mockLogs = [
      {
        timestamp: "2026-07-18T10:00:00Z",
        turn: 0,
        agent_name: "経済システム",
        agent_code: "支払/非支払",
        message: "テストメッセージ 支払",
        provider: "ollama",
        model: "m1",
      },
    ];
    vi.mocked(fetchSimulationLogs).mockResolvedValueOnce(mockLogs);

    render(<App />);

    // Load logs via the load UI
    const input = screen.getByPlaceholderText("過去シミュレーションID");
    fireEvent.change(input, { target: { value: "test-sim-id" } });

    const loadBtn = screen.getByLabelText("load-logs");
    fireEvent.click(loadBtn);

    // Wait for the gauge container to be rendered
    const gaugeContainer = await screen.findByTestId("app-binary-gauge-container");
    expect(gaugeContainer).toBeInTheDocument();
    
    // Check if the gauge has the correct text / score
    expect(screen.getByTestId("binary-code-gauge")).toBeInTheDocument();
    expect(screen.getByText("SCORE: 1.00")).toBeInTheDocument();
  });
});

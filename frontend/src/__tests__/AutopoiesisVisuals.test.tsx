import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { BinaryCodeGauge, analyzeMessageCode } from "../components/BinaryCodeGauge";
import { EducationalPanel, TAB_CONTENT } from "../components/EducationalPanel";
import { NetworkGraph } from "../components/NetworkGraph";
import type { AgentNode } from "../types";

describe("BinaryCodeGauge component and scoring logic", () => {
  test("analyzeMessageCode analyzes poles and handles substring conflicts", () => {
    // positive keyword only
    expect(analyzeMessageCode("支払/非支払", "支払")).toBe(1.0);
    // negative keyword only
    expect(analyzeMessageCode("支払/非支払", "非支払")).toBe(0.0);
    // empty or neutral text defaults to 0.5
    expect(analyzeMessageCode("支払/非支払", "")).toBe(0.5);
    expect(analyzeMessageCode("支払/非支払", "こんにちは")).toBe(0.5);

    // substring conflict handling: "非支払" contains "支払"
    expect(analyzeMessageCode("支払/非支払", "非支払")).toBe(0.0);

    // both keywords: "支払と非支払" -> negCount = 1, posCount = 2 -> posCount = 2 - 1 = 1 -> score = 0.5
    expect(analyzeMessageCode("支払/非支払", "支払と非支払")).toBe(0.5);

    // another substring conflict where pos contains neg (e.g. positive "合法", negative "非合法")
    expect(analyzeMessageCode("合法/非合法", "非合法")).toBe(0.0);
    expect(analyzeMessageCode("合法/非合法", "合法")).toBe(1.0);
    expect(analyzeMessageCode("合法/非合法", "合法と非合法")).toBe(0.5);
  });

  test("renders BinaryCodeGauge and needle positions correctly", () => {
    const { rerender } = render(<BinaryCodeGauge binaryCode="支払/非支払" messageText="支払" />);
    expect(screen.getByTestId("binary-code-gauge")).toBeInTheDocument();
    expect(screen.getByText("支払 (+)")).toBeInTheDocument();
    expect(screen.getByText("非支払 (-)")).toBeInTheDocument();

    // Needle style position for score 1.0 (percent = 100%)
    let needle = screen.getByTestId("gauge-needle");
    expect(needle.style.left).toBe("calc(100% - 2px)");

    // Rerender with negative keyword (score 0.0)
    rerender(<BinaryCodeGauge binaryCode="支払/非支払" messageText="非支払" />);
    needle = screen.getByTestId("gauge-needle");
    expect(needle.style.left).toBe("calc(0% - 2px)");

    // Rerender with neutral (score 0.5)
    rerender(<BinaryCodeGauge binaryCode="支払/非支払" messageText="" />);
    needle = screen.getByTestId("gauge-needle");
    expect(needle.style.left).toBe("calc(50% - 2px)");
  });
});

describe("EducationalPanel component", () => {
  test("renders panel when open, not when closed", () => {
    const handleClose = vi.fn();
    const { rerender } = render(<EducationalPanel isOpen={false} onClose={handleClose} />);
    expect(screen.queryByTestId("educational-panel")).not.toBeInTheDocument();

    rerender(<EducationalPanel isOpen={true} onClose={handleClose} />);
    expect(screen.getByTestId("educational-panel")).toBeInTheDocument();
  });

  test("switches tabs and displays respective description contents", () => {
    const handleClose = vi.fn();
    render(<EducationalPanel isOpen={true} onClose={handleClose} />);

    // Default active tab should be autopoiesis
    expect(screen.getByTestId("tab-title")).toHaveTextContent(TAB_CONTENT.autopoiesis.title);
    expect(screen.getByTestId("tab-content")).toHaveTextContent(TAB_CONTENT.autopoiesis.content);

    // Switch to Operational Closure (closure)
    fireEvent.click(screen.getByTestId("tab-closure"));
    expect(screen.getByTestId("tab-title")).toHaveTextContent(TAB_CONTENT.closure.title);
    expect(screen.getByTestId("tab-content").textContent?.replace(/\s+/g, " ")).toContain(TAB_CONTENT.closure.content.replace(/\s+/g, " "));

    // Switch to Binary Codes (binary)
    fireEvent.click(screen.getByTestId("tab-binary"));
    expect(screen.getByTestId("tab-title")).toHaveTextContent(TAB_CONTENT.binary.title);
    expect(screen.getByTestId("tab-content")).toHaveTextContent(TAB_CONTENT.binary.content);

    // Switch to Structural Coupling (coupling)
    fireEvent.click(screen.getByTestId("tab-coupling"));
    expect(screen.getByTestId("tab-title")).toHaveTextContent(TAB_CONTENT.coupling.title);
    expect(screen.getByTestId("tab-content")).toHaveTextContent(TAB_CONTENT.coupling.content);
  });

  test("triggers onClose callback when clicking the close button", () => {
    const handleClose = vi.fn();
    render(<EducationalPanel isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByTestId("close-panel-btn");
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe("NetworkGraph boundaries, ripples, and communication paths", () => {
  const mockAgents: Record<string, AgentNode> = {
    A: { name: "A", binaryCode: "支払/非支払", concern: "Money", provider: "p", model: "m", speakCount: 2, state: "idle" },
    B: { name: "B", binaryCode: "真/偽", concern: "Truth", provider: "p", model: "m", speakCount: 1, state: "idle" },
    C: { name: "C", binaryCode: "法/不法", concern: "Law", provider: "p", model: "m", speakCount: 0, state: "idle" },
  };

  test("renders operational closure halos around each node", () => {
    render(<NetworkGraph agents={mockAgents} edges={[]} currentSpeaker={null} nextSpeaker={null} />);

    // Each node should have a corresponding concentric closure halo
    expect(screen.getByTestId("halo-A")).toBeInTheDocument();
    expect(screen.getByTestId("halo-B")).toBeInTheDocument();
    expect(screen.getByTestId("halo-C")).toBeInTheDocument();
  });

  test("renders environmental irritation ripples only for the active speaker node", () => {
    const { rerender } = render(
      <NetworkGraph agents={mockAgents} edges={[]} currentSpeaker={null} nextSpeaker={null} />
    );

    // When there is no current speaker, irritation ripples should not be rendered
    expect(screen.queryByTestId("irritation-ripples")).not.toBeInTheDocument();

    // Set A as the current speaker
    rerender(<NetworkGraph agents={mockAgents} edges={[]} currentSpeaker="A" nextSpeaker={null} />);
    expect(screen.getByTestId("irritation-ripples")).toBeInTheDocument();

    // The node A element group should contain the irritation ripples
    const nodeA = screen.getByTestId("node-A");
    expect(nodeA.querySelector('[data-testid="irritation-ripples"]')).toBeInTheDocument();

    // Node B group should not contain irritation ripples
    const nodeB = screen.getByTestId("node-B");
    expect(nodeB.querySelector('[data-testid="irritation-ripples"]')).toBeNull();
  });

  test("computes and renders autopoietic path of communication correctly", () => {
    const mockMessages: import("../types").Message[] = [
      { agent_name: "A", turn: 0, timestamp: "t0", agent_code: "c", message: "m0", provider: "p", model: "m" },
      { agent_name: "B", turn: 1, timestamp: "t1", agent_code: "c", message: "m1", provider: "p", model: "m" },
      { agent_name: "C", turn: 2, timestamp: "t2", agent_code: "c", message: "m2", provider: "p", model: "m" },
    ];

    const { rerender } = render(
      <NetworkGraph agents={mockAgents} edges={[]} currentSpeaker={null} nextSpeaker={null} messages={[]} />
    );

    // Empty or single message sequence does not yield a communication path
    expect(screen.queryByTestId("autopoietic-path")).not.toBeInTheDocument();

    // Render with 3 message sequence (forming 2 connecting line segments)
    rerender(
      <NetworkGraph
        agents={mockAgents}
        edges={[]}
        currentSpeaker={null}
        nextSpeaker={null}
        messages={mockMessages}
      />
    );

    expect(screen.getByTestId("autopoietic-path")).toBeInTheDocument();
    const pathGroup = screen.getByTestId("autopoietic-path");
    const pathLines = pathGroup.querySelectorAll("line");
    // 3 points -> 2 line segments connecting them (A to B, and B to C)
    expect(pathLines).toHaveLength(2);
  });
});

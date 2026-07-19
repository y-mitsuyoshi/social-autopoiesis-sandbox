import { render, screen, fireEvent } from "@testing-library/react";
import { SimulationForm } from "../components/SimulationForm";

test("空のお題では送信ボタンが無効化される", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const button = screen.getByRole("button", { name: /START/ });
  expect(button).toBeDisabled();
});

test("お題を入力すると送信ボタンが有効化される", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });
  const button = screen.getByRole("button", { name: /START/ });
  expect(button).not.toBeDisabled();
});

test("送信時に onSubmit が呼ばれる", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });
  const button = screen.getByRole("button", { name: /START/ });
  fireEvent.click(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({
    trigger_message: "テストお題",
    max_turns: 3,
    agent_order_mode: "fixed",
  });
});

test("agent_order_mode を dynamic に切り替えられる", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });
  const dynamic = screen.getByLabelText("dynamic");
  fireEvent.click(dynamic);
  const button = screen.getByRole("button", { name: /START/ });
  fireEvent.click(button);
  expect(onSubmit).toHaveBeenCalledWith({
    trigger_message: "テストお題",
    max_turns: 3,
    agent_order_mode: "dynamic",
    agents_config: "config/presets/agents-3-dynamic.yaml",
  });
});

test("プリセットを選択すると agent_order_mode が自動同期される", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });

  // 3 Agents + Moderator (Dynamic) プリセットを選択
  const select = screen.getByLabelText(/エージェント構成プリセット/);
  fireEvent.change(select, { target: { value: "config/presets/agents-3-dynamic.yaml" } });

  const button = screen.getByRole("button", { name: /START/ });
  fireEvent.click(button);

  expect(onSubmit).toHaveBeenCalledWith({
    trigger_message: "テストお題",
    max_turns: 3,
    agent_order_mode: "dynamic",
    agents_config: "config/presets/agents-3-dynamic.yaml",
  });
});
import { render, screen, fireEvent } from "@testing-library/react";
import { SimulationForm } from "../components/SimulationForm";

test("空のお題では送信ボタンが無効化される", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const button = screen.getByRole("button", { name: /開始/ });
  expect(button).toBeDisabled();
});

test("お題を入力すると送信ボタンが有効化される", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });
  const button = screen.getByRole("button", { name: /開始/ });
  expect(button).not.toBeDisabled();
});

test("送信時に onSubmit が呼ばれる", () => {
  const onSubmit = vi.fn();
  render(<SimulationForm onSubmit={onSubmit} />);
  const textarea = screen.getByPlaceholderText(/お題を入力/);
  fireEvent.change(textarea, { target: { value: "テストお題" } });
  const button = screen.getByRole("button", { name: /開始/ });
  fireEvent.click(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({
    trigger_message: "テストお題",
    max_turns: 3,
  });
});
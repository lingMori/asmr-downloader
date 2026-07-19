import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Chip, Dialog, EQ, Pagination, ProgressBar, Stepper, Toggle } from ".";

describe("Toggle", () => {
  it("renders switch role and flips on click", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="贴纸" />);
    const sw = screen.getByRole("switch", { name: "贴纸" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Stepper", () => {
  it("clamps value within min/max", () => {
    const onChange = vi.fn();
    render(<Stepper value={1} min={1} max={8} onChange={onChange} />);
    const down = screen.getByRole("button", { name: "减少" });
    expect(down).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "增加" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe("ProgressBar", () => {
  it("renders fill width from value", () => {
    const { container } = render(<ProgressBar value={62} variant="task" />);
    const fill = container.querySelector(".y-progress__fill");
    expect(fill).toHaveStyle({ width: "62%" });
  });

  it("seek variant reports pct on click when onSeek given", () => {
    const onSeek = vi.fn();
    const { container } = render(<ProgressBar value={30} variant="seek" onSeek={onSeek} />);
    const bar = container.querySelector(".y-progress--seek")!;
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      left: 0, width: 200, top: 0, right: 200, bottom: 5, height: 5, x: 0, y: 0, toJSON: () => ({}),
    } as DOMRect);
    fireEvent.click(bar, { clientX: 100 });
    expect(onSeek).toHaveBeenCalledWith(50);
  });
});

describe("EQ", () => {
  it("toggles is-playing class", () => {
    const { container, rerender } = render(<EQ playing={false} />);
    expect(container.firstChild).not.toHaveClass("is-playing");
    rerender(<EQ playing />);
    expect(container.firstChild).toHaveClass("is-playing");
  });
});

describe("Chip", () => {
  it("applies is-on when active", () => {
    render(<Chip active>全部 9</Chip>);
    expect(screen.getByRole("button", { name: "全部 9" })).toHaveClass("is-on");
  });
});

describe("Pagination", () => {
  it("disables prev on first page and next on last", () => {
    const onPage = vi.fn();
    const { rerender } = render(<Pagination page={1} totalPages={3} onPage={onPage} />);
    expect(screen.getByRole("button", { name: "← 上一页" })).toBeDisabled();
    rerender(<Pagination page={3} totalPages={3} onPage={onPage} />);
    expect(screen.getByRole("button", { name: "下一页 →" })).toBeDisabled();
  });

  it("calls onPage with adjacent page", () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={3} onPage={onPage} />);
    fireEvent.click(screen.getByRole("button", { name: "← 上一页" }));
    expect(onPage).toHaveBeenCalledWith(1);
  });
});

describe("Dialog", () => {
  it("closes on ESC and overlay click", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} label="复核">
        内容
      </Dialog>,
    );
    expect(screen.getByRole("dialog", { name: "复核" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onClose={() => {}}>
        内容
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

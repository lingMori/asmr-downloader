import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { DeckDialog } from "./dialog";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("DeckDialog", () => {
  it("sends Escape only to the topmost dialog", () => {
    const onBottomChange = vi.fn();
    const onTopChange = vi.fn();

    render(
      <>
        <DeckDialog
          open
          onOpenChange={onBottomChange}
          kicker="底层"
          title="底层弹窗"
        >
          <button type="button">底层操作</button>
        </DeckDialog>
        <DeckDialog
          open
          onOpenChange={onTopChange}
          kicker="顶层"
          title="顶层弹窗"
        >
          <button type="button">顶层操作</button>
        </DeckDialog>
      </>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onTopChange).toHaveBeenCalledWith(false);
    expect(onBottomChange).not.toHaveBeenCalled();
  });

  it("restores body scrolling after nested dialogs unmount together", () => {
    const view = render(<DialogPair open />);
    expect(document.body.style.overflow).toBe("hidden");

    view.rerender(<DialogPair open={false} />);

    expect(document.body.style.overflow).toBe("");
  });
});

function DialogPair({ open }: { open: boolean }) {
  return (
    <>
      <DeckDialog open={open} onOpenChange={() => undefined} kicker="底层" title="底层弹窗">
        <button type="button">底层操作</button>
      </DeckDialog>
      <DeckDialog open={open} onOpenChange={() => undefined} kicker="顶层" title="顶层弹窗">
        <button type="button">顶层操作</button>
      </DeckDialog>
    </>
  );
}

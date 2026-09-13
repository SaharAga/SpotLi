/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AutoArchivePromptModal } from "./AutoArchivePromptModal";
import { LanguageProvider } from "../context/LanguageContext";

function renderWithContext(ui) {
  return render(
    <LanguageProvider>
      {ui}
    </LanguageProvider>
  );
}

describe("AutoArchivePromptModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = renderWithContext(
      <AutoArchivePromptModal isOpen={false} onConfirm={vi.fn()} onDecline={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders prompt text and responds to confirm and decline actions", () => {
    const handleConfirm = vi.fn();
    const handleDecline = vi.fn();

    renderWithContext(
      <AutoArchivePromptModal isOpen={true} onConfirm={handleConfirm} onDecline={handleDecline} />
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    
    // Find confirm button and click
    const yesButton = screen.getByText(/Yes, Auto-Archive|כן, העבר אוטומטית לארכיון/i);
    fireEvent.click(yesButton);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    // Find decline button and click
    const noButton = screen.getByText(/No, Keep in Delivered|לא, השאר ברשימת הנמסרו/i);
    fireEvent.click(noButton);
    expect(handleDecline).toHaveBeenCalledTimes(1);
  });

  it("links dialog aria-labelledby to title and provides header close button", () => {
    const handleDecline = vi.fn();

    const { unmount } = renderWithContext(
      <AutoArchivePromptModal isOpen={true} onConfirm={vi.fn()} onDecline={handleDecline} />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "auto-archive-title");
    const title = document.getElementById("auto-archive-title");
    expect(title).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: "Close" });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(handleDecline).toHaveBeenCalledTimes(1);

    unmount();

    localStorage.setItem("deliveree_lang", "he");
    renderWithContext(
      <AutoArchivePromptModal isOpen={true} onConfirm={vi.fn()} onDecline={handleDecline} />
    );
    expect(screen.getByRole("button", { name: "סגור" })).toBeInTheDocument();
  });
});


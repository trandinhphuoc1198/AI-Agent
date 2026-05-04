import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PermissionModal from "../src/components/PermissionModal";

describe("PermissionModal", () => {
  it("renders the command text", () => {
    render(
      <PermissionModal
        command="rm -rf /tmp"
        onApprove={() => {}}
        onDeny={() => {}}
      />
    );
    expect(screen.getByText("rm -rf /tmp")).toBeInTheDocument();
  });

  it("shows the modal title", () => {
    render(
      <PermissionModal command="ls" onApprove={() => {}} onDeny={() => {}} />
    );
    expect(
      screen.getByText(/Shell Permission Required/i)
    ).toBeInTheDocument();
  });

  it("calls onApprove when Approve button is clicked", () => {
    const onApprove = vi.fn();
    render(
      <PermissionModal command="ls" onApprove={onApprove} onDeny={() => {}} />
    );
    fireEvent.click(screen.getByText("Approve"));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("calls onDeny when Deny button is clicked", () => {
    const onDeny = vi.fn();
    render(
      <PermissionModal command="ls" onApprove={() => {}} onDeny={onDeny} />
    );
    fireEvent.click(screen.getByText("Deny"));
    expect(onDeny).toHaveBeenCalledOnce();
  });

  it("has role='dialog' with aria-modal='true'", () => {
    render(
      <PermissionModal command="ls" onApprove={() => {}} onDeny={() => {}} />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("has an aria-labelledby pointing to the title element", () => {
    render(
      <PermissionModal command="ls" onApprove={() => {}} onDeny={() => {}} />
    );
    const dialog = screen.getByRole("dialog");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(labelId)).toBeInTheDocument();
  });

  it("does not call onApprove when Deny is clicked", () => {
    const onApprove = vi.fn();
    render(
      <PermissionModal
        command="ls"
        onApprove={onApprove}
        onDeny={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Deny"));
    expect(onApprove).not.toHaveBeenCalled();
  });
});

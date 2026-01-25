/**
 * Accessibility utilities for improved a11y across the application
 */

import * as React from "react";

/**
 * Focus trap hook for modals and dialogs
 * Traps focus within a container element
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement>, isActive: boolean = true) {
    React.useEffect(() => {
        if (!isActive || !containerRef.current) return;

        const container = containerRef.current;
        const focusableElements = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        // Focus first element on mount
        firstFocusable?.focus();

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== "Tab") return;

            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable?.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable?.focus();
                }
            }
        }

        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
    }, [containerRef, isActive]);
}

/**
 * Announce messages to screen readers
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite") {
    const announcement = document.createElement("div");
    announcement.setAttribute("role", "status");
    announcement.setAttribute("aria-live", priority);
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
    key: string,
    callback: () => void,
    options: {
        ctrlKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
        disabled?: boolean;
    } = {}
) {
    const { ctrlKey = false, shiftKey = false, altKey = false, disabled = false } = options;

    React.useEffect(() => {
        if (disabled) return;

        function handleKeyDown(e: KeyboardEvent) {
            if (
                e.key.toLowerCase() === key.toLowerCase() &&
                e.ctrlKey === ctrlKey &&
                e.shiftKey === shiftKey &&
                e.altKey === altKey
            ) {
                e.preventDefault();
                callback();
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [key, callback, ctrlKey, shiftKey, altKey, disabled]);
}

/**
 * Hook for skip link functionality
 */
export function useSkipLink(targetId: string) {
    const skipToContent = React.useCallback(() => {
        const target = document.getElementById(targetId);
        if (target) {
            target.setAttribute("tabindex", "-1");
            target.focus();
            target.removeAttribute("tabindex");
        }
    }, [targetId]);

    return skipToContent;
}

/**
 * ARIA helper for data tables
 */
export function getTableAriaProps(options: {
    caption?: string;
    rowCount: number;
    currentPage?: number;
    pageSize?: number;
}): React.AriaAttributes & { "aria-label"?: string } {
    const { caption, rowCount, currentPage, pageSize } = options;

    let ariaLabel = caption || "Data table";

    if (rowCount > 0) {
        ariaLabel += `. ${rowCount} baris`;

        if (currentPage && pageSize) {
            const startRow = (currentPage - 1) * pageSize + 1;
            const endRow = Math.min(currentPage * pageSize, rowCount);
            ariaLabel += `, menampilkan baris ${startRow} sampai ${endRow}`;
        }
    } else {
        ariaLabel += ". Tidak ada data.";
    }

    return {
        "aria-label": ariaLabel,
        "aria-rowcount": rowCount,
    };
}

/**
 * Generate unique IDs for form fields
 */
let idCounter = 0;
export function useId(prefix: string = "id"): string {
    const [id] = React.useState(() => `${prefix}-${++idCounter}`);
    return id;
}

/**
 * CSS class for visually hidden but accessible content
 */
export const srOnlyClass = "absolute w-[1px] h-[1px] p-0 -m-[1px] overflow-hidden whitespace-nowrap border-0";

/**
 * Component for visually hidden accessible text
 */
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
    return <span className={ srOnlyClass }> { children } </span>;
}

"use client";

import * as React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface InfoCardWrapperProps {
    /** Short tooltip text shown on hover */
    tooltip: string;
    /** Detailed explanation shown in modal on click */
    detailTitle: string;
    detailDescription: string;
    children: React.ReactNode;
}

/**
 * Wraps any dashboard card with:
 * 1. A "?" help icon at top-right that shows a tooltip on hover
 * 2. The entire card is clickable to open a detail modal
 */
export function InfoCardWrapper({ tooltip, detailTitle, detailDescription, children }: InfoCardWrapperProps) {
    const [open, setOpen] = React.useState(false);

    return (
        <TooltipProvider delayDuration={200}>
            <div className="relative group cursor-pointer" onClick={() => setOpen(true)}>
                {/* Help icon */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="absolute top-2 right-2 z-10 p-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                            aria-label="Bantuan"
                        >
                            <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {tooltip}
                    </TooltipContent>
                </Tooltip>

                {/* Card content */}
                {children}
            </div>

            {/* Detail Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <HelpCircle className="h-5 w-5 text-primary" />
                            {detailTitle}
                        </DialogTitle>
                        <DialogDescription className="text-left whitespace-pre-line leading-relaxed pt-2">
                            {detailDescription}
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    );
}

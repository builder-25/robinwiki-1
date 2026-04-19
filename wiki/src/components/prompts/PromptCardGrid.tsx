"use client";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getPromptIcon } from "@/lib/promptIcons";
import type { WikiTypeListItem } from "@/hooks/useWikiTypesList";
import { cn } from "@/lib/utils";

export interface PromptCardGridProps {
  items: WikiTypeListItem[];
}

export default function PromptCardGrid({ items }: PromptCardGridProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No wiki types available.</p>
    );
  }
  return (
    <ul
      data-slot="prompt-card-grid"
      className="PROMPT_CARD_GRID grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {items.map((t) => {
        const Icon = getPromptIcon(t.slug);
        return (
          <li key={t.slug}>
            <Link
              href={`/profile/prompts/${t.slug}`}
              className={cn(
                "block h-full rounded-lg border border-border bg-background",
                "transition-colors hover:bg-muted/50 focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label={`Edit ${t.displayLabel} prompt`}
            >
              <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="flex gap-3 p-4">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-foreground"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-sm font-medium">
                        {t.displayLabel}
                      </h3>
                      {t.userModified ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Customized
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.displayDescription || t.displayShortDescriptor}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";
import type { InputVariable } from "@/hooks/useWikiTypesList";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface VariableChipListProps {
  variables: InputVariable[];
  onInsert: (name: string) => void;
  className?: string;
}

export default function VariableChipList({
  variables,
  onInsert,
  className,
}: VariableChipListProps) {
  if (variables.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No variables declared for this prompt.
      </p>
    );
  }
  return (
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {variables.map((v) => (
        <li key={v.name}>
          <button
            type="button"
            onClick={() => onInsert(v.name)}
            title={v.description}
            className="group flex w-full items-center gap-2 rounded border border-input bg-transparent px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
          >
            <code className="font-mono text-[11px] text-foreground">{`{{${v.name}}}`}</code>
            <Badge
              variant={v.required ? "default" : "secondary"}
              className="ml-auto text-[10px]"
            >
              {v.required ? "required" : "optional"}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}

import type { ReactNode } from "react";
import type { InputVariable } from "@/hooks/useWikiTypesList";

export type { InputVariable };

export interface SaveResult {
  basedOnVersion: number;
  warnings: string[];
}

export interface ApiErrorBody {
  code?: string;
  error: string;
  detail?: unknown;
}

export type EditorMode = "full-yaml" | "system-message-only";

export interface PromptEditorProps {
  /** Wiki-type slug. Used for API URL and sessionStorage keys. */
  slug: string;
  /** Display label for the header (e.g. "Log"). */
  displayLabel: string;
  /** Current YAML from the API (promptYaml). */
  initialYaml: string;
  /** Canonical default YAML (defaultYaml). Used by Reset in Plan 05. */
  defaultYaml: string;
  /** Variables declared by the prompt spec. Rendered in the chip panel (Plan 03). */
  inputVariables: InputVariable[];
  /** Version the promptYaml is based on. Shown as read-only metadata. */
  basedOnVersion: number;
  /** Whether the prompt has been user-modified. Controls Reset button enabled state. */
  userModified: boolean;
  /** Invoked after a successful save with the server's response. */
  onSaved?: (result: SaveResult) => void;
  /** Invoked when the editor requests close (modal mount). Ignored in full-page mount. */
  onClose?: () => void;
  /** Compact layout for the onboarding modal: no header, no right pane, no footer Cancel. */
  compact?: boolean;
  /** Phase 4 preview-button slot — rendered in the footer between Reset and Save. */
  footerActions?: ReactNode;
  /** Phase 3 extension: "system-message-only" narrows the editor to the system_message field. */
  mode?: EditorMode;
  /** Emits whenever the editor's dirty state (yaml !== savedYaml) changes. */
  onDirtyChange?: (dirty: boolean) => void;
}

import type { ApiErrorBody } from "./types";

type Detailer = (detail: unknown) => string;

const MAP: Record<string, Detailer> = {
  YAML_TOO_LARGE: () =>
    "Prompt exceeds the 32KB size limit. Shorten the template or descriptions.",
  YAML_PARSE_ERROR: (d) =>
    `YAML syntax error: ${typeof d === "string" ? d : "check indentation and colons."}`,
  YAML_SCHEMA_ERROR: () =>
    "Prompt schema is invalid — required fields may be missing or typed wrong.",
  TEMPLATE_SYNTAX_ERROR: (d) =>
    `Handlebars template syntax error: ${typeof d === "string" ? d : "check your {{…}} braces."}`,
  UNSUPPORTED_BLOCK_PARAM: (d) => {
    const helper = (d as { helper?: string } | null | undefined)?.helper ?? "";
    return `Block parameters aren't supported${helper ? ` on "${helper}"` : ""}. Use the raw variable name instead of {{#each items as |it|}}.`;
  },
  DISALLOWED_HELPER: (d) => {
    const list = Array.isArray(d)
      ? (d as Array<{ helper: string }>).map((e) => e.helper).filter(Boolean).join(", ")
      : "";
    return `Unsupported helper(s)${list ? `: ${list}` : ""}. Only 'if' and 'each' are allowed.`;
  },
  MISSING_REQUIRED_VAR: (d) => {
    const missing = (d as { missing?: string[] } | null | undefined)?.missing ?? [];
    return `Required variables missing from template: ${missing.join(", ") || "(none reported)"}.`;
  },
};

/** Map a server ApiErrorBody to a user-facing string. Unknown codes fall back to `error`. */
export function describeSaveError(body: ApiErrorBody): string {
  if (body.code && MAP[body.code]) return MAP[body.code](body.detail);
  if (body.error) return body.error;
  return "Save failed. Check connection and retry.";
}

export const NETWORK_ERROR_MESSAGE =
  "Save failed. Check connection and retry.";

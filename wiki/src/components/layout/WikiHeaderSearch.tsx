"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import WikiSearchBar from "@/components/wiki/WikiSearchBar";

/** Search in the wiki header row — same vertical band as menu / Add Wiki / profile */
function WikiHeaderSearchInner() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const qFromUrl = sp.get("q") ?? "";
  const [draft, setDraft] = useState("");
  const prevPathRef = useRef("");

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    if (pathname.startsWith(ROUTES.search)) {
      setDraft(qFromUrl);
      return;
    }
    if (
      prev.startsWith(ROUTES.search) &&
      !pathname.startsWith(ROUTES.search)
    ) {
      setDraft("");
    }
  }, [pathname, qFromUrl]);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    router.push(`${ROUTES.search}?q=${encodeURIComponent(t)}`);
  };

  return (
    <div
      className="flex min-h-0 min-w-0 w-full max-w-[591px] items-stretch justify-center"
      style={{
        background: "var(--wiki-chat-bg)",
        borderRadius: 0,
        padding: "6px 10px",
        boxSizing: "border-box",
      }}
    >
      <WikiSearchBar
        embedded
        compact
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
      />
    </div>
  );
}

export default function WikiHeaderSearch() {
  return (
    <Suspense
      fallback={
        <div
          className="h-[38px] w-full max-w-[591px] shrink-0 rounded-[24px]"
          style={{ background: "var(--wiki-chat-bg)" }}
          aria-hidden
        />
      }
    >
      <WikiHeaderSearchInner />
    </Suspense>
  );
}

"use client";

import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, FileCode, UserRound } from "lucide-react";
import WikiSearchBar from "@/components/wiki/WikiSearchBar";
import { useSession } from "@/hooks/useSession";
import { T } from "@/lib/typography";

type HeroFilter = "people" | "fragments" | "wiki";

const FILTER_COLORS: Record<HeroFilter, { fg: string; bg: string }> = {
  // People stays yellow (our deviation)
  people: { fg: "var(--wiki-type-people-text)", bg: "var(--wiki-type-people-bg)" },
  // Fragments — pick a neutral fragment color; using the Fact/sky shade
  fragments: { fg: "var(--fragment-type-fact-text)", bg: "var(--fragment-type-fact-bg)" },
  // Wiki — uses the wiki-link blue
  wiki: { fg: "var(--wiki-link)", bg: "rgba(51, 102, 204, 0.10)" },
};

function HomeSearchBlock({ activeFilter }: { activeFilter: HeroFilter | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const qFromUrl = sp.get("q") ?? "";
  const [draft, setDraft] = useState("");
  const prevPathRef = useRef("");

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;

    if (pathname.startsWith("/wiki/search")) {
      setDraft(qFromUrl);
      return;
    }
    if (
      prev.startsWith("/wiki/search") &&
      !pathname.startsWith("/wiki/search")
    ) {
      setDraft("");
    }
  }, [pathname, qFromUrl]);

  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    const typeParam = activeFilter ? `&type=${activeFilter}` : "";
    router.push(`/wiki/search?q=${encodeURIComponent(t)}${typeParam}`);
  };

  return (
    <div
      className="w-full max-w-[591px] min-w-0 overflow-hidden"
      style={{
        background: "var(--wiki-chat-bg)",
        boxSizing: "border-box",
      }}
    >
      <WikiSearchBar
        layout="stacked"
        embedded
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        placeholder="What are you looking for?"
      />
    </div>
  );
}

function FilterChip({
  id,
  icon,
  label,
  active,
  onToggle,
}: {
  id: HeroFilter;
  icon: ReactNode;
  label: string;
  active: boolean;
  onToggle: (id: HeroFilter) => void;
}) {
  const colors = FILTER_COLORS[id];
  const idleColor = "var(--wiki-count)";
  const idleBg = "var(--surface-subtle)";
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1"
      style={{
        padding: "2px 8px",
        background: active ? colors.bg : idleBg,
        border: `1px solid ${active ? colors.fg : idleBg}`,
        color: active ? colors.fg : idleColor,
        transition: "background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease",
      }}
    >
      <span
        className="flex h-3 w-3 shrink-0 items-center justify-center"
        style={{ color: active ? colors.fg : idleColor }}
      >
        {icon}
      </span>
      <span
        style={{
          ...T.micro,
          letterSpacing: "-0.0288px",
          color: "inherit",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/** Figma ROBIN 217:35527 — title + chat search + filter chips (wiki home only) */
export default function WikiHomeHero() {
  const { session } = useSession();
  // Single-select filter state. Clicking the active chip deactivates it.
  const [activeFilter, setActiveFilter] = useState<HeroFilter | null>(null);
  const greeting = session?.user?.name ?? "Welcome back";
  const toggleFilter = (id: HeroFilter) => {
    setActiveFilter((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className="flex w-full flex-col items-center"
      style={{ gap: 30, maxWidth: 864, marginLeft: "auto", marginRight: "auto" }}
    >
      <div
        className="flex items-center justify-center"
        style={{ padding: 10, boxSizing: "border-box" }}
      >
        <h1
          className="wiki-home-title m-0 text-center"
          style={{
            ...T.hero,
            color: "var(--wiki-title)",
            maxWidth: "100%",
            paddingLeft: 8,
            paddingRight: 8,
            boxSizing: "border-box",
            whiteSpace: "normal",
          }}
        >
          {greeting}
        </h1>
      </div>

      <div
        className="flex w-full min-w-0 flex-col items-stretch"
        style={{ gap: 8, maxWidth: 591 }}
      >
        <Suspense
          fallback={
            <div
              className="h-[88px] w-full max-w-[591px] shrink-0"
              style={{ background: "var(--wiki-chat-bg)" }}
              aria-hidden
            />
          }
        >
          <HomeSearchBlock activeFilter={activeFilter} />
        </Suspense>

        <div
          className="flex flex-wrap items-start justify-start"
          style={{ gap: 8 }}
        >
          <FilterChip
            id="people"
            label="People"
            active={activeFilter === "people"}
            onToggle={toggleFilter}
            icon={<UserRound size={12} strokeWidth={1.5} aria-hidden />}
          />
          <FilterChip
            id="fragments"
            label="Fragments"
            active={activeFilter === "fragments"}
            onToggle={toggleFilter}
            icon={<FileCode size={12} strokeWidth={1.5} aria-hidden />}
          />
          <FilterChip
            id="wiki"
            label="Wiki"
            active={activeFilter === "wiki"}
            onToggle={toggleFilter}
            icon={<BookOpen size={12} strokeWidth={1.5} aria-hidden />}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  KeyRound,
  LogOut,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { ModelSelector } from "@/components/ModelSelector";
import {
  isEmbeddingModel,
  useModelPreferences,
} from "@/hooks/useModelPreferences";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/hooks/useProfile";
import { useStats } from "@/hooks/useStats";
import { authClient } from "@/lib/auth-client";

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const profileQuery = useProfile();
  const statsQuery = useStats();
  const modelPrefs = useModelPreferences();
  const [copied, setCopied] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const username = session?.user?.name ?? session?.user?.email ?? "";
  const canDelete = deleteConfirm === username;

  const endpointUrl = profileQuery.data?.mcpEndpointUrl ?? "";

  const handleCopy = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push("/");
  };

  const stats = [
    { count: 0, label: "Fragments" },
    { count: 0, label: "Unattached Fragments" },
    { count: statsQuery.data?.totalThreads ?? 0, label: "Wikis" },
    { count: statsQuery.data?.peopleCount ?? 0, label: "People" },
  ];

  if (sessionLoading || profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-y-auto bg-background text-foreground">
      <div className="mx-auto max-w-[780px] px-10 pt-12 pb-20">
        {/* Back navigation */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-6 -ml-2 h-auto gap-1.5 px-2 text-muted-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} />
          Back
        </Button>

        {/* Profile header */}
        <h1 className="font-heading text-3xl font-semibold text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Robin control panel
        </p>

        {/* MCP CONNECTION */}
        <section className="mt-8 space-y-3">
          <SectionLabel>MCP Connection</SectionLabel>

          <Card size="sm" className="gap-3 rounded-none">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">
                    Connected
                  </span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Endpoint
                </p>
                <div className="mt-1.5 flex items-center gap-3 border border-border bg-muted/40 px-3.5 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {endpointUrl}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopy}
                    title={copied ? "Copied!" : "Copy endpoint"}
                    className="flex shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="size-4" strokeWidth={1.75} />
                    ) : (
                      <Copy className="size-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* KNOWLEDGE STATS */}
        <section className="mt-8 space-y-3">
          <SectionLabel>Knowledge Stats</SectionLabel>

          <Card size="sm" className="gap-0 rounded-none py-0">
            <div className="grid grid-cols-4 divide-x divide-border">
              {stats.map((stat) => (
                <div key={stat.label} className="px-2 py-5 text-center">
                  <p className="font-heading text-2xl font-semibold text-foreground">
                    {stat.count}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* PROMPTS */}
        <section className="mt-8 space-y-3">
          <SectionLabel>Prompts</SectionLabel>
          <Card size="sm" className="rounded-none">
            <CardContent className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Customize prompts
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Edit how each wiki type structures your knowledge.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => router.push("/profile/prompts")}
              >
                Manage prompts
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* AI MODELS */}
        <section className="mt-8 space-y-3">
          <SectionLabel>AI Models</SectionLabel>

          <Card size="sm" className="rounded-none">
            <CardContent className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Configure which models Robin uses for each pipeline stage.
              </p>

              {modelPrefs.loading ? (
                <div className="flex items-center gap-2 py-4">
                  <Spinner className="size-4" />
                  <span className="text-xs text-muted-foreground">
                    Loading models...
                  </span>
                </div>
              ) : modelPrefs.error && !modelPrefs.preferences ? (
                <p className="py-4 text-xs text-destructive">
                  {modelPrefs.error}
                </p>
              ) : (
                <div className="grid gap-4 pt-2 sm:grid-cols-2">
                  <ModelSelector
                    label="Extraction"
                    description="Extracts atomic ideas from raw thoughts"
                    models={modelPrefs.models}
                    value={modelPrefs.preferences.extraction}
                    onChange={(id) =>
                      modelPrefs.updatePreference("extraction", id)
                    }
                    disabled={modelPrefs.saveStatus === "saving"}
                  />
                  <ModelSelector
                    label="Classification"
                    description="Classifies fragments into topic clusters"
                    models={modelPrefs.models}
                    value={modelPrefs.preferences.classification}
                    onChange={(id) =>
                      modelPrefs.updatePreference("classification", id)
                    }
                    disabled={modelPrefs.saveStatus === "saving"}
                  />
                  <ModelSelector
                    label="Wiki Generation"
                    description="Generates and updates wiki pages"
                    models={modelPrefs.models}
                    value={modelPrefs.preferences.wikiGeneration}
                    onChange={(id) =>
                      modelPrefs.updatePreference("wikiGeneration", id)
                    }
                    disabled={modelPrefs.saveStatus === "saving"}
                  />
                  <ModelSelector
                    label="Embeddings"
                    description="Creates vector embeddings (1536-dim only)"
                    models={modelPrefs.models}
                    value={modelPrefs.preferences.embedding}
                    onChange={(id) =>
                      modelPrefs.updatePreference("embedding", id)
                    }
                    filterFn={isEmbeddingModel}
                    disabled={modelPrefs.saveStatus === "saving"}
                  />
                </div>
              )}

              {modelPrefs.saveStatus !== "idle" && (
                <p
                  className={cn(
                    "pt-1 text-xs transition-opacity",
                    modelPrefs.saveStatus === "saving" &&
                      "text-muted-foreground",
                    modelPrefs.saveStatus === "saved" && "text-emerald-600",
                    modelPrefs.saveStatus === "error" && "text-destructive",
                  )}
                >
                  {modelPrefs.saveStatus === "saving" && "Saving..."}
                  {modelPrefs.saveStatus === "saved" && "Saved"}
                  {modelPrefs.saveStatus === "error" && "Failed to save"}
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* WIKI MANAGEMENT */}
        <section className="mt-8 space-y-3">
          <SectionLabel>Wiki Management</SectionLabel>

          <Card size="sm" className="rounded-none">
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {profileQuery.data?.name ?? username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {statsQuery.data?.totalThreads ?? 0} wikis
                  </span>
                </div>
                <button
                  type="button"
                  className="flex shrink-0 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
                  title="Edit vault"
                >
                  <Pencil className="size-4" strokeWidth={1.5} />
                </button>
              </div>

              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <RefreshCw className="size-3.5" strokeWidth={1.5} />
                Re-profile
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* DATA */}
        <section className="mt-8 space-y-3">
          <SectionLabel>Data</SectionLabel>
          <Card size="sm" className="rounded-none">
            <CardContent className="space-y-5">
              <ActionRow
                title="Export all data"
                description="Download all wikis and people as JSON"
                icon={<Download className="size-4" strokeWidth={1.5} />}
                onClick={() => {}}
              />
              <ActionRow
                title="Export keypair"
                description="Download your Ed25519 public and private key as JSON"
                icon={<KeyRound className="size-4" strokeWidth={1.5} />}
                onClick={() => {}}
              />
            </CardContent>
          </Card>
        </section>

        {/* LOG OUT */}
        <section className="mt-8 space-y-3">
          <SectionLabel>Session</SectionLabel>
          <Card size="sm" className="rounded-none">
            <CardContent>
              <ActionRow
                title="Log out"
                description="Sign out of your account on this device"
                icon={<LogOut className="size-4" strokeWidth={1.5} />}
                onClick={handleSignOut}
              />
            </CardContent>
          </Card>
        </section>

        {/* DANGER ZONE */}
        <section className="mt-8 space-y-3">
          <SectionLabel className="text-destructive">Danger zone</SectionLabel>
          <Card size="sm" className="rounded-none ring-destructive/30">
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Delete all data
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Permanently delete all wikis and people
                  </p>
                </div>
                <Dialog
                  open={deleteOpen}
                  onOpenChange={(open) => {
                    setDeleteOpen(open);
                    if (!open) setDeleteConfirm("");
                  }}
                >
                  <DialogTrigger
                    render={
                      <Button
                        type="button"
                        size="sm"
                        className="bg-destructive text-white hover:bg-destructive/90"
                      >
                        Delete
                      </Button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete all data</DialogTitle>
                      <DialogDescription>
                        This permanently deletes all wikis and people. This
                        action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="delete-confirm" className="text-xs">
                        Type{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {username}
                        </span>{" "}
                        to confirm.
                      </Label>
                      <Input
                        id="delete-confirm"
                        autoComplete="off"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        placeholder={username}
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose
                        render={
                          <Button type="button" variant="outline" size="sm">
                            Cancel
                          </Button>
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canDelete}
                        className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                        onClick={() => {
                          setDeleteOpen(false);
                          setDeleteConfirm("");
                        }}
                      >
                        Delete everything
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function ActionRow({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
        {icon}
      </span>
    </button>
  );
}

"use client";

import { useState } from "react";

import { T } from "@/lib/typography";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccountStepProps {
  onNext: () => void;
}

export default function AccountStep({ onNext }: AccountStepProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isValid =
    username.trim().length > 0 &&
    password.length >= 6 &&
    password === confirmPassword;

  return (
    <div className="flex flex-col items-start" style={{ width: 320 }}>
      <p
        className="whitespace-nowrap"
        style={{
          ...T.overline,
          color: "var(--section-label)",
        }}
      >
        Account
      </p>

      <h1
        className="whitespace-nowrap"
        style={{
          ...T.h1,
          color: "var(--heading-color)",
        }}
      >
        Set up your account
      </h1>

      <p
        style={{
          marginTop: 8,
          ...T.micro,
          color: "var(--subtitle)",
        }}
      >
        Create your login credentials
      </p>

      <div className="mt-16 flex w-full flex-col gap-5">
        <div className="flex w-full flex-col gap-1.5">
          <Label
            htmlFor="onboarding-username"
            className="uppercase tracking-[0.32px] text-[12px]"
            style={{ color: "var(--input-label)" }}
          >
            Username
          </Label>
          <Input
            id="onboarding-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
          />
        </div>

        <div className="flex w-full flex-col gap-1.5">
          <Label
            htmlFor="onboarding-password"
            className="uppercase tracking-[0.32px] text-[12px]"
            style={{ color: "var(--input-label)" }}
          >
            Password
          </Label>
          <Input
            id="onboarding-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 6 characters"
            autoComplete="new-password"
          />
        </div>

        <div className="flex w-full flex-col gap-1.5">
          <Label
            htmlFor="onboarding-confirm-password"
            className="uppercase tracking-[0.32px] text-[12px]"
            style={{ color: "var(--input-label)" }}
          >
            Confirm Password
          </Label>
          <Input
            id="onboarding-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
          />
          <p
            className="pt-1"
            style={{ ...T.helper, color: "var(--helper-text)" }}
          >
            Single-user setup. Your data stays on your machine.
          </p>
        </div>
      </div>

      <ActionButton
        type="button"
        onClick={onNext}
        disabled={!isValid}
        className="mt-12 self-end"
      >
        Continue
      </ActionButton>
    </div>
  );
}

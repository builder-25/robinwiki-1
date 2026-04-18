import { T } from "@/lib/typography";
import Image from "next/image";
import { ActionButton } from "@/components/ui/action-button";

interface WelcomeStepProps {
  onNext: () => void;
}

function Logo() {
  return (
    <Image
      src="/logo.png"
      alt="Robin logo"
      width={40}
      height={40}
    />
  );
}

export default function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <div className="flex flex-col items-center" style={{ width: 320 }}>
      <Logo />

      <h1
        className="whitespace-nowrap"
        style={{
          ...T.h1,
          marginTop: 12,
          color: "var(--heading-color)",
        }}
      >
        Robin
      </h1>

      <p
        className="text-center whitespace-nowrap"
        style={{
          ...T.bodySmall,
          marginTop: 20,
          color: "var(--subtitle-soft)",
        }}
      >
        Your personal wikipedia
      </p>
      <p
        className="text-center whitespace-nowrap"
        style={{
          ...T.bodySmall,
          marginTop: 4,
          color: "var(--subtitle-soft)",
        }}
      >
        Built from everything you know
      </p>

      <ActionButton type="button" onClick={onNext} className="mt-[90px]">
        Get Started
      </ActionButton>
    </div>
  );
}

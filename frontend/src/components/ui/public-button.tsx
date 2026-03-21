type PublicButtonVariant = "primary" | "secondary";
type PublicButtonSize = "sm" | "md" | "lg";

type PublicButtonProps = {
  label: string;
  variant?: PublicButtonVariant;
  size?: PublicButtonSize;
  type?: "button" | "submit" | "reset";
};

export default function PublicButton({
  label,
  variant = "primary",
  size = "md",
  type = "button",
}: PublicButtonProps) {
  const baseClasses =
    "rounded-2xl font-semibold transition hover:-translate-y-0.5";

  const variantClasses =
    variant === "primary"
      ? "bg-slate-950 text-white shadow-lg shadow-slate-300/40 hover:bg-slate-800"
      : "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50";

  const sizeClasses =
    size === "sm"
      ? "px-3 py-1.5 text-xs"
      : size === "lg"
      ? "px-6 py-3 text-sm"
      : "px-4 py-2 text-sm";

  return (
    <button
      type={type}
      className={`${baseClasses} ${variantClasses} ${sizeClasses}`}
    >
      {label}
    </button>
  );
}
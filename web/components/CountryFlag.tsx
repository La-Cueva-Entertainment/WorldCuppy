export function CountryFlag({
  code,
  label,
  className,
}: {
  code: string;
  label: string;
  className?: string;
}) {
  const normalized = code.trim().toLowerCase();

  // FIFA pages often use 3-letter team codes (e.g. ARG/USA/ENG). When we have
  // those, render the official flag image from FIFA's API.
  const isFifaTrigram = /^[a-z]{3}$/.test(normalized);
  if (isFifaTrigram) {
    return (
      <img
        src={`https://api.fifa.com/api/v3/picture/flags-sq-4/${normalized.toUpperCase()}`}
        alt={label}
        title={label}
        loading="lazy"
        className={[
          "inline-block",
          "rounded-sm",
          "ring-1",
          "ring-white/10",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  return (
    <span
      className={[
        "fi",
        `fi-${normalized}`,
        "rounded-sm",
        "ring-1",
        "ring-white/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      title={label}
    />
  );
}

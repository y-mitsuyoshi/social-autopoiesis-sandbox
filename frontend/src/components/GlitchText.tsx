export interface GlitchTextProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "span" | "div";
}

export function GlitchText({ text, className = "", as = "span" }: GlitchTextProps) {
  const Tag = as;
  return (
    <Tag className={`glitch-text neon-glow ${className}`} data-text={text}>
      {text}
    </Tag>
  );
}
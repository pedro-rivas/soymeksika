export const TITLE_STYLES = [
  { id: "pop", label: "Pop + underline" },
  { id: "rise", label: "Rise up" },
  { id: "blur", label: "Soft focus" },
  { id: "typewriter", label: "Typewriter" },
  { id: "slam", label: "Slam" },
] as const;

export type TitleStyleId = (typeof TITLE_STYLES)[number]["id"];

export const DEFAULT_TITLE_STYLE: TitleStyleId = "pop";

import { SOCIAL_LABELS, SOCIAL_PLATFORMS, type SocialPlatform } from "../lib/pins";
import { SOCIAL_ICONS } from "./socialIcons";

const PROFILE_HREFS: Record<SocialPlatform, string> = {
  youtube: "https://www.youtube.com/@soymeksika",
  tiktok: "https://www.tiktok.com/@soymeksika",
  facebook: "https://www.facebook.com/soymeksika",
  instagram: "https://www.instagram.com/soymeksika",
};

export default function SocialLinks() {
  return (
    <nav
      aria-label="Social media"
      className="pointer-events-none fixed top-3 right-3 z-[100000] flex items-center gap-2"
    >
      {SOCIAL_PLATFORMS.map((platform) => (
        <a
          key={platform}
          href={PROFILE_HREFS[platform]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`soymeksika on ${SOCIAL_LABELS[platform]}`}
          className="pointer-events-auto flex items-center justify-center text-black transition hover:opacity-70"
        >
          {SOCIAL_ICONS[platform]}
        </a>
      ))}
    </nav>
  );
}

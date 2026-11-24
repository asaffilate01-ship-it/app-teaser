import logoOnDark from "@/assets/criclume-logo-on-dark.png.asset.json";
import logoOnLight from "@/assets/criclume-logo-header.png.asset.json";

/** CricLume wordmark that follows the light/dark switch (each theme gets the artwork made for it). */
export function BrandLogo({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <>
      <img
        src={logoOnDark.url}
        alt="CricLume"
        width={840}
        height={276}
        className={`theme-dark-only ${className}`}
      />
      <img
        src={logoOnLight.url}
        alt=""
        aria-hidden="true"
        width={1600}
        height={600}
        className={`theme-light-only ${className}`}
      />
    </>
  );
}

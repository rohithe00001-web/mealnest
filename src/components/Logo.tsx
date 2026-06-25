import logo from "@/assets/mealnest-logo.png.asset.json";

type Props = {
  className?: string;
  alt?: string;
};

export function LogoMark({ className = "h-9 w-9", alt = "MealNest" }: Props) {
  return (
    <img
      src={logo.url}
      alt={alt}
      width={64}
      height={64}
      className={`${className} object-contain rounded-xl`}
      loading="eager"
      decoding="async"
    />
  );
}

export const LOGO_URL = logo.url;

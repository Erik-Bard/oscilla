import { useEffect, useRef, useState } from "react";

const FALLBACK_TINT = "#4338ca";

export function useCoverTint(imageUrl: string | null) {
  const [tint, setTint] = useState(FALLBACK_TINT);
  useEffect(() => {
    if (!imageUrl) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(image, 0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        setTint(`rgb(${r} ${g} ${b})`);
      } catch {
        setTint(FALLBACK_TINT);
      }
    };
    image.src = imageUrl;
    return () => {
      image.onload = null;
    };
  }, [imageUrl]);
  return imageUrl ? tint : FALLBACK_TINT;
}

export function useHeroTitle(
  name: string | undefined,
  onHeroTitleHidden: (name: string | null) => void,
) {
  const heroTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!name || !heroTitle.current) return;
    const observer = new IntersectionObserver(([entry]) =>
      onHeroTitleHidden(entry.isIntersecting ? null : name),
    );
    observer.observe(heroTitle.current);
    return () => {
      observer.disconnect();
      onHeroTitleHidden(null);
    };
  }, [name, onHeroTitleHidden]);
  return heroTitle;
}

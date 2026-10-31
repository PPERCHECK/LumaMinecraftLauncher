import aurora from "./assets/aurora.jpg";
import rose from "./assets/rose.jpg";
import forest from "./assets/forest.jpg";
import ocean from "./assets/ocean.jpg";
import mountain from "./assets/mountain.jpg";
import night from "./assets/night.jpg";

export const photos: Record<string, string> = { aurora, rose, forest, ocean, mountain, night };
export const photoNames = Object.keys(photos);
export function Photo({ variant = "aurora", className = "" }: { variant?: string; className?: string }) {
  return <img className={"photo " + className} src={photos[variant] || photos.aurora} alt="" />;
}

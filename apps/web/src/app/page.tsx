import MapLoader from "./components/MapLoader";
import SocialLinks from "./components/SocialLinks";
import { readPins } from "./lib/pinsStore";

export default async function Home() {
  const pins = await readPins();

  return (
    <main className="h-screen w-screen overflow-hidden">
      <SocialLinks />
      <MapLoader initialPins={pins} />
    </main>
  );
}

import MapLoader from "./components/MapLoader";
import SocialLinks from "./components/SocialLinks";

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <SocialLinks />
      <MapLoader />
    </main>
  );
}

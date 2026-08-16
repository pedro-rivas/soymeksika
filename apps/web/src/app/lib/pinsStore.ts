import { promises as fs } from "fs";
import path from "path";
import { parsePin, type Pin } from "./pins";

const PINS_PATH = path.join(process.cwd(), "data", "pins.json");

export async function readPins(): Promise<Pin[]> {
  try {
    const raw = await fs.readFile(PINS_PATH, "utf8");
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(parsePin).filter((p): p is Pin => p != null);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function writePins(pins: Pin[]) {
  await fs.mkdir(path.dirname(PINS_PATH), { recursive: true });
  await fs.writeFile(PINS_PATH, `${JSON.stringify(pins, null, 2)}\n`, "utf8");
}

import { prisma } from '../../src/lib/prisma.js';

// Stop ids by name, so tests read like the story: stopId('Mohakhali').
export async function stopIds() {
  const stops = await prisma.stop.findMany();
  const byName = new Map(stops.map((s) => [s.name, s.id]));
  return (name: string) => {
    const id = byName.get(name);
    if (id === undefined) throw new Error(`No stop named ${name}`);
    return id;
  };
}


export const BRAZIL_ADJACENCY: Record<string, string[]> = {
  "AC": ["RO", "AM"],
  "AL": ["PE", "SE", "BA"],
  "AP": ["PA"],
  "AM": ["AC", "RO", "MT", "PA", "RR"],
  "BA": ["ES", "MG", "GO", "TO", "PI", "PE", "AL", "SE"],
  "CE": ["PI", "RN", "PB", "PE"],
  "DF": ["GO", "MG"],
  "ES": ["BA", "MG", "RJ"],
  "GO": ["MT", "MS", "MG", "DF", "BA", "TO"],
  "MA": ["PA", "TO", "PI"],
  "MT": ["RO", "AM", "PA", "TO", "GO", "MS"],
  "MS": ["MT", "GO", "MG", "SP", "PR"],
  "MG": ["BA", "ES", "RJ", "SP", "MS", "GO", "DF"],
  "PA": ["AP", "MA", "TO", "MT", "AM", "RR"],
  "PB": ["CE", "RN", "PE"],
  "PR": ["MS", "SP", "SC"],
  "PE": ["CE", "PI", "BA", "AL", "PB"],
  "PI": ["MA", "CE", "PE", "BA", "TO"],
  "RJ": ["ES", "MG", "SP"],
  "RN": ["CE", "PB"],
  "RS": ["SC"],
  "RO": ["AC", "AM", "MT"],
  "RR": ["AM", "PA"],
  "SC": ["PR", "RS"],
  "SP": ["MG", "RJ", "PR", "MS"],
  "SE": ["BA", "AL"],
  "TO": ["MA", "PI", "BA", "GO", "MT", "PA"]
};

/**
 * Finds the shortest path between two UFs using Breadth-First Search.
 * Returns the intermediate UFs (percurso), excluding start and end.
 */
export function findShortestPath(start: string, end: string): string[] | null {
  if (start === end) return [];
  if (!BRAZIL_ADJACENCY[start] || !BRAZIL_ADJACENCY[end]) return null;

  const queue: [string, string[]][] = [[start, [start]]];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;

    if (current === end) {
      // Return path without the start and end UFs
      return path.filter(uf => uf !== start && uf !== end);
    }

    const neighbors = BRAZIL_ADJACENCY[current] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }

  return null;
}

/**
 * Checks if a UF can be added to the current sequence.
 * A UF is valid if it neighbors the last UF in the sequence (including origin/destination boundaries).
 */
export function isValidNextStep(uf: string, currentPath: string[], origin: string, destination: string): boolean {
  // If no path yet, must neighbor origin
  if (currentPath.length === 0) {
    return BRAZIL_ADJACENCY[origin]?.includes(uf) || false;
  }

  // Must neighbor the last UF in current selection
  const lastUf = currentPath[currentPath.length - 1];
  return BRAZIL_ADJACENCY[lastUf]?.includes(uf) || false;
}

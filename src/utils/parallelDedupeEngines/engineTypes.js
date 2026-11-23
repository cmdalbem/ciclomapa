import { run as runHybridTagGeometry } from './hybrid_tag_geometry.js';
import { run as runGeometryFirst } from './geometry_first.js';
import { run as runTopologyFirst } from './topology_first.js';
import { run as runCorridorMerge } from './corridor_merge.js';

// For Fortaleza negative/positive training sets, topology_first is the most precise.
export const DEFAULT_PARALLEL_DEDUPE_ENGINE = 'topology_first';

export const PARALLEL_DEDUPE_ENGINES = [
  'hybrid_tag_geometry',
  'geometry_first',
  'topology_first',
  'corridor_merge',
];

export function resolveParallelDedupeEngineId(engineId) {
  return PARALLEL_DEDUPE_ENGINES.includes(engineId) ? engineId : DEFAULT_PARALLEL_DEDUPE_ENGINE;
}

export function getParallelDedupeEngine(engineId) {
  switch (resolveParallelDedupeEngineId(engineId)) {
    case 'hybrid_tag_geometry':
      return runHybridTagGeometry;
    case 'geometry_first':
      return runGeometryFirst;
    case 'topology_first':
      return runTopologyFirst;
    case 'corridor_merge':
      return runCorridorMerge;
    default:
      return runTopologyFirst;
  }
}

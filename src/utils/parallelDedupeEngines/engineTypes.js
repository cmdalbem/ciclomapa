import { run as runLegacyNameAngle } from './legacy_name_angle.js';
import { run as runHybridTagGeometry } from './hybrid_tag_geometry.js';
import { run as runGeometryFirst } from './geometry_first.js';
import { run as runTopologyFirst } from './topology_first.js';
import { run as runCorridorMerge } from './corridor_merge.js';

// Default to the best-performing non-legacy engine.
// For your Fortaleza negative/positive training sets, `topology_first`
// is the most precise (0 false positives in the evaluator).
export const DEFAULT_PARALLEL_DEDUPE_ENGINE = 'topology_first';

export const PARALLEL_DEDUPE_ENGINES = [
  'legacy_name_angle',
  'hybrid_tag_geometry',
  'geometry_first',
  'topology_first',
  'corridor_merge',
];

export function getParallelDedupeEngine(engineId) {
  switch (engineId) {
    case 'legacy_name_angle':
      return runLegacyNameAngle;
    // For now, fall back to legacy until alternatives are implemented.
    case 'hybrid_tag_geometry':
      return runHybridTagGeometry;
    case 'geometry_first':
      return runGeometryFirst;
    case 'topology_first':
      return runTopologyFirst;
    case 'corridor_merge':
      return runCorridorMerge;
    default:
      return runLegacyNameAngle;
  }
}

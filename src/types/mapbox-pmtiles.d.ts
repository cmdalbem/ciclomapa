declare module 'mapbox-pmtiles' {
  // `mapbox-pmtiles` ships TypeScript sources and can fail strict typechecking
  // inside node_modules. We intentionally treat it as untyped at the app layer.
  export const PmTilesSource: any;
}

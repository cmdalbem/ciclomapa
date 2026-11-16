# Local BRouter PoC

Self-hosted bike routing for the web app via the CRA proxy (`/local-brouter`).

Needs Java 17+ (`java -version`). Docker Desktop on this Mac profile is locked to a work org, so BRouter runs as a jar.

## BRouter

Tiles live in `routing/brouter/segments4/` (5×5°). [`run-local.sh`](brouter/run-local.sh) downloads:

| Tile      | Area                 |
| --------- | -------------------- |
| `W50_S25` | São Paulo            |
| `E0_N40`  | Barcelona / NE Spain |

```bash
chmod +x routing/brouter/run-local.sh
./routing/brouter/run-local.sh
```

Barcelona smoke test:

```bash
curl -s "http://localhost:17777/brouter?lonlats=2.1686,41.3874|2.1744,41.4036&profile=ciclomapa&alternativeidx=0&format=geojson" | head
```

`.env`:

```
REACT_APP_BROUTER_LOCAL_BASE_URL=/local-brouter
```

Restart `yarn start` after changing that.

Profile: `routing/brouter/profiles2/ciclomapa.brf` (costs mirrored from `ROUTE_INFRASTRUCTURE_QUALITY_WEIGHTS`; bare streets expensive). Cobertura **BR tags** classifies OSM way tags from the response. Restart BRouter after editing the `.brf`.

Jar + segment tiles stay out of git.

## Trying Barcelona in the app

1. BRouter running with `E0_N40`.
2. `.env` PMTiles pointed at Spain archives (not São Paulo):

```
REACT_APP_PMTILES_FILENAME=spain-poi.pmtiles
REACT_APP_PMTILES_ZG_FILENAME=spain-poi.pmtiles
REACT_APP_PMTILES_Z13_FILENAME=spain-poi.pmtiles
REACT_APP_PMTILES_ANALYSIS_FILENAME=spain-analysis.pmtiles
```

3. Restart `yarn start`.
4. Open Barcelona, set Serviço to **BRouter** or **Combinado**, pick an OD.

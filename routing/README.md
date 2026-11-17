# Local BRouter PoC

Self-hosted bike routing for the web app via the CRA proxy (`/local-brouter`).

Needs Java 17+ (`java -version`). Docker Desktop on this Mac profile is locked to a work org, so BRouter runs as a jar.

## BRouter

Tiles live in `routing/brouter/segments4/` (5×5°). [`run-local.sh`](brouter/run-local.sh) pulls:

| Coverage                         | Notes                                      |
| -------------------------------- | ------------------------------------------ |
| Whole Brazil (`W75..W35` × `S35..N5`) | ~81 candidates; empty ocean tiles 404/skip |
| Whole Spain (mainland, Balearics, Canaries) | `W10/W5/E0` × `N35/N40` plus Canaries `W20/W15_N25` |

First Brazil download is chunky (many `.rd5` files). Re-runs only fetch what's missing. Heap defaults to 2g (`BROUTER_XMX=4g` if long cross-country routes OOM).

```bash
./routing/brouter/run-local.sh
```

Smoke tests:

```bash
# São Paulo
curl -s "http://localhost:17777/brouter?lonlats=-46.6334,-23.5507|-46.6558,-23.5614&profile=ciclomapa&alternativeidx=0&format=geojson" | head

# Barcelona
curl -s "http://localhost:17777/brouter?lonlats=2.1686,41.3874|2.1744,41.4036&profile=ciclomapa&alternativeidx=0&format=geojson" | head
```

`.env`:

```
REACT_APP_BROUTER_LOCAL_BASE_URL=/local-brouter
```

Restart `yarn start` after changing that.

Profile: `routing/brouter/profiles2/ciclomapa.brf` (costs mirrored from `ROUTE_INFRASTRUCTURE_QUALITY_WEIGHTS`; bare streets expensive). Cobertura **BR tags** classifies OSM way tags from the response. Restart BRouter after editing the `.brf`.

Jar + segment tiles stay out of git.

## Trying PoCs in the app

1. BRouter running (Brazil tiles + `E0_N40` for Spain).
2. Bottom-right **PoC** control: **Off** (env tiles) / **SP** / **BR** / **ES**.
3. Set Serviço to **BRouter** or **Combinado**, pick an OD.

BR jumps to Brasília and loads `brazil-poi.pmtiles`. ES jumps to Barcelona and loads the Spain archives. SP keeps the zg/z13/z15 tile compare.

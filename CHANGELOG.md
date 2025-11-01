# Changelog

All notable changes to CicloMapa will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-10-31

### 🎉 Major Features

#### Route Planning & Directions (NEW)
- **Complete route planning system** with multiple routing providers:
  - GraphHopper integration (default)
  - Valhalla routing support  
  - Hybrid mode combining multiple services for route comparison
- **Route coverage analysis** showing overlap with cycling infrastructure
  - Detailed breakdown by infrastructure type
  - Route scoring system prioritizing better cycling infrastructure
  - Minimum 5% coverage threshold for display
- **Interactive route selection** with hover states and visual comparison
  - Two-way sync between panel and map
  - Route tooltips with coverage information
  - Visual focus through color manipulation
- **Elevation information** for GraphHopper routes
- **Route sorting** by distance, duration, or infrastructure coverage
- **URL integration** - route data persists in URL for sharing
- **Google Maps Places API** integration for improved geocoding
  - More relevant results
  - Geolocation support for origin input
- **Route options** with full colored breakdown and badges
- **Swap origin/destination** button
- **City boundary enforcement** - routes limited to same city
- **Automatic city detection** when addresses are entered

#### Light Mode Theme (NEW)
- **Complete light mode implementation** with automatic OS detection
- **Dynamic palette system** with automatic color adjustments
- **HSL lightness compensation** for better readability
- **Improved readability** across all components in light mode
  - Fixed missing Ant Design styles
  - Fixed popover and tooltip text colors
  - Fixed spinner text colors
- **Theme toggle** with smooth transitions
- **Reviewed cycleways palette** for both light and dark modes

#### PMTiles Data Source (NEW)
- **PMTiles integration** for faster data loading from Amazon S3
- **Hybrid data architecture** combining PMTiles with Firebase/GeoJSON
- **Smart data prioritization** - fresh GeoJSON data takes precedence over PMTiles
- **Performance improvements** through optimized tile loading
- **Brazil-wide coverage** via PMTiles
- **Hover effects** for PMTiles layers
- **isPmtilesAvailable()** function to skip Firebase loads when PMTiles are available

### ✨ Enhanced Features

#### Mobile Experience
- **Complete mobile redesign** for route planning interface
- **Touch-optimized interactions** for POIs and cycleways
  - Clickable POIs at any zoom level
  - Center map on active element when opening tooltips
  - Click & zoom behavior improvements
- **Auto-geolocation** for route origin on mobile
- **Auto-focus destination** input
- **Mobile-specific UI optimizations**:
  - Directions panel layout improvements
  - Route skeletons positioning
  - Filter bar with collapsing behavior
  - Disabled layers button during routing
  - Routes button as primary action
- **Improved popups and tooltips** for mobile devices
- **Bottom sheet component** (prepared for future use)
- **City input width** fixes
- **iPhone Safari zoom prevention** on input controls

#### POI (Points of Interest) Improvements
- **Redesigned POI icons** with 2x resolution for high-DPI screens (16px → 18px)
- **All new POI styles** with improved visibility
- **Dynamic zoom thresholds** for better performance
- **Enhanced POI filtering** with expandable filter sections
- **Fill area layer** for polygon bike parkings
- **Improved click and hover interactions**
- **Smaller and crisper mini POIs**
- **POI icon size and offset tweaks**
- **Many rendering style improvements** across zoom levels

#### Filtering System
- **New filter bar** on mobile with collapsing categories
- **Sticky active filters** (Spotify-style UI)
- **Improved filter merging logic** keeping same category filters together
- **Layer visibility controls** for data sources
- **Layers bar expose cycleway types**
- **Improved dotted line rendering** in filter bar
- **Collapsing behavior** to "Outras" category

#### Map & Layers Enhancements
- **Layer legends modal** for better understanding of infrastructure types
- **Protection level badges** with visual indicators and improved icons
- **Improved cycleway hover effects** and selected states
- **Map popups 3.0** with redesigned layout:
  - New cycleway tags
  - Added directions button
  - Pixel-perfect tiny icons in footer toolbar
  - Better spacing inside popups
- **City boundaries** visualization from OSM with dashed line
- **Realistic sun positioning** based on geographic location and time
- **Updated satellite layers**
- **Improved cycleway colors and palette** with dynamic dark mode support
- **Road side indication** - shows which side of the road the cyclepath is on
- **Thinner cyclepaths** (2x thinner) for better visibility
- **Route paths render underneath** street names
- **Map click improvements** during route planning

#### Analytics & Data Visualization
- **Route coverage breakdown** with detailed statistics
- **Analytics sidebar improvements** with better dashed pattern rendering
- **Fresh data checks** (30 days threshold)
- **Async data loading** - accept stale data while loading fresh data
- **Length calculations optimization**
- **Round down lengths** and hide bars for < 1% in analytics

### 🔧 Technical Improvements

#### Architecture & Performance
- **DirectionsManager class** for centralized route calculation logic
- **DirectionsProvider hook** for better state management
- **Smart storage system** with chunking and retrocompatibility
- **OSM URL generation refactored** to utilities
- **Improved error handling** with better error messages in Storage and OSMController
- **Double layer approach** for route rendering performance
- **Debounced OSM calls** to reduce API load
- **Optimized layer visibility updates**
- **Zoom thresholds** for map interactivity
- **Disabled unnecessary calculations** that were always running
- **Smart chunking** for data storage
- **Auto-change map area** with debounced OSM calls
- **Route data flow refactoring** between components
- **Top-bottom system** for overlapping cycleways

#### Code Quality & Refactoring
- **Major refactoring** of directions components:
  - Generic component accepting multiple services
  - Centralized score calculation in Manager
  - Route utilities extracted for reusability
- **DirectionsPanel.js refactor** for markers and geocoders handling
- **Improved component organization** and separation of concerns
- **Better prop management** and guards for geocoders
- **CSS dynamic variables** approach for theming
- **Coverage data structure refactoring**
- **Route constants organization**
- **Simplified directionsService**
- **Extra map init checks** and variable names refactor

#### Infrastructure
- **Whitelisted cities** system (experimental)
- **Force update** capability for whitelisted cities with OSM data
- **Global controls** for disabled data sources
- **OSM loading notification** improvements
- **Fresh data handling** with graceful fallbacks

### 🐛 Bug Fixes

- Fixed geolocation position on mobile
- Fixed route matching between panel and map
- Fixed cyclepaths popup color issues
- Fixed input blurring bugs
- Fixed map click issues during route planning
- Fixed logo display
- Fixed "Edit on OSM" modal not opening
- Fixed toast notifications not auto-dismissing
- Fixed z-index issues with DirectionsPanel
- Fixed road labels rendering in light mode
- Fixed loading precalculated lengths from database
- Fixed multiple directions calculation bug
- Fixed iPhone Safari zoom on input controls
- Fixed spinner text color in light mode
- Fixed popover content text color in light mode
- Fixed nav buttons not being rounded
- Fixed new topbar loading message on mobile
- Fixed theme toggle button bug
- Fixed city picker clipping issue
- Fixed issues with new circles POI layer missing callbacks
- Fixed max hybrid cap limiting bug
- Fixed cyclepaths hover
- Fixed layers visibility update performance

### 🎨 UI/UX Polish

- **Improved spacing** in map popups
- **Better tooltip positioning** to prevent overlaps
- **Smooth animations** and transitions throughout
  - Softer, more elegant transitions in LayersBar
  - Improved animations and interactions
  - Fade-in transition for routes panel
- **Improved route tooltip styling** for selected/unselected states
- **Enhanced route option cards** with full colored breakdown badges
- **Better route fit bounds** with mobile/desktop compensation
- **Fly-to animation** when setting origin
- **Improved topbar** with:
  - Loading states
  - Data tooltips with better design
  - Updated timestamp display
- **About modal improvements** with divider color fixes
- **Refined filter bar** with dotted line improvements
- **Chunkier layers panel** for better usability
- **Many tooltip improvements**:
  - New layer images
  - Translations
  - Link ellipsis
  - Layer type description tooltips
- **Small color tweaks** in logo and ciclovias in dark mode

### 🔄 Removed/Deprecated

- Removed OpenRouteService integration
- Removed React strictMode for dev experience
- Removed theme memory (now uses OS detection)
- Removed Barcelona from whitelisted cities (now uses standard flow)
- Removed boundary from OSM query
- Temporarily disabled conditional opacity of overlapping paths
- Temporarily disabled setting points from clicking on map (during route planning)

### 📝 Other Changes

- Added environment variables to gitignore
- Upgraded deprecated props and components
- Improved translations and tooltips
- Added comments and documentation
- Minor style tweaks and refinements throughout
- Change "Baixa velocidade" to "Residenciais"
- Priority changes between ciclorrotas and calçadas
- Camera tilting re-enabled

---

## [Unreleased]

### Future Improvements
- Expandable bottom sheet (currently disabled)
- Detailed route coverage breakdown (not in use at the moment)

---

## How to Upgrade

For users upgrading from v2.x:

### New Requirements
- **Google Maps Places API key** - Required for route planning geocoding features
- **PMTiles support** - Automatic when PMTiles data is available for your region

### Breaking Changes
- Light mode is now enabled by default and respects OS settings
- Route planning requires Google Maps Places API configuration
- Some UI elements have been redesigned for better mobile experience
- Theme preference is no longer stored (uses OS detection)

### Migration Notes
- If you have custom theme preferences, they will be reset to OS detection
- Old route URLs may need to be updated to new format
- Check that your Google Maps API key has Places API enabled

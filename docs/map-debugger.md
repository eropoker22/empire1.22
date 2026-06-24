# Map Debugger

The manifest debug data is available through:

`createEmpireCityMapDebugReport(empireStreetsCityMapManifest)`

The report includes:

- district count
- Downtown count
- spawn candidate count
- manifest hash
- articulation points
- bridge edges
- chokepoint districts
- distance to nearest Downtown
- spawn candidate neighbor count
- spawn candidate route to center

Client/debug UI must use the same generated map asset as the canvas. A debugger may highlight:

- selected district
- neighbor districts
- spawn candidates
- Downtown
- articulation points
- bridge edges
- chokepoints

Debugger overlays must not maintain their own district list, polygon list, or adjacency list.

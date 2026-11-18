"""folium_lite — interactive maps rendered with Leaflet (PyArcade shim).

Real-life equivalent: the `folium` package (`folium.Map`, `folium.CircleMarker`,
`folium.PolyLine`, `.add_to(m)`, `m.save("map.html")`).
Difference on the site: the map appears directly in the page; `save()` does nothing.
"""

_maps = []


def _reset():
    _maps.clear()


class Map:
    def __init__(self, location=(48.8566, 2.3522), zoom_start=12, tiles=None, **kwargs):
        self.location = [float(location[0]), float(location[1])]
        self.zoom_start = int(zoom_start)
        self.children = []
        _maps.append(self)

    def add_child(self, child):
        self.children.append(child)
        return self

    def save(self, path):
        return None

    def _to_json(self):
        return {"center": self.location, "zoom": self.zoom_start, "items": [c._to_json() for c in self.children]}


class _Layer:
    def add_to(self, m):
        m.add_child(self)
        return self


class CircleMarker(_Layer):
    def __init__(self, location, radius=6, popup=None, tooltip=None, color="#3388ff", fill=True, fill_color=None, fill_opacity=0.8, **kwargs):
        self.location = [float(location[0]), float(location[1])]
        self.radius = float(radius)
        self.popup = None if popup is None else str(popup)
        self.tooltip = None if tooltip is None else str(tooltip)
        self.color = color
        self.fill = fill
        self.fill_color = fill_color or color
        self.fill_opacity = fill_opacity

    def _to_json(self):
        return {"kind": "circle", "loc": self.location, "radius": self.radius, "popup": self.popup, "tooltip": self.tooltip,
                "color": self.color, "fill": self.fill, "fillColor": self.fill_color, "fillOpacity": self.fill_opacity}


class Marker(_Layer):
    def __init__(self, location, popup=None, tooltip=None, **kwargs):
        self.location = [float(location[0]), float(location[1])]
        self.popup = None if popup is None else str(popup)
        self.tooltip = None if tooltip is None else str(tooltip)

    def _to_json(self):
        return {"kind": "marker", "loc": self.location, "popup": self.popup, "tooltip": self.tooltip}


class PolyLine(_Layer):
    def __init__(self, locations, color="#3388ff", weight=3, opacity=1.0, tooltip=None, **kwargs):
        self.locations = [[float(p[0]), float(p[1])] for p in locations]
        self.color = color
        self.weight = weight
        self.opacity = opacity
        self.tooltip = None if tooltip is None else str(tooltip)

    def _to_json(self):
        return {"kind": "line", "locs": self.locations, "color": self.color, "weight": self.weight, "opacity": self.opacity, "tooltip": self.tooltip}

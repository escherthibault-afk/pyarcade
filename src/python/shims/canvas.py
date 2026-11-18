"""canvas — tiny drawing API shown in an HTML <canvas> (PyArcade shim).

Real-life equivalent: pygame (`screen.fill`, `pygame.draw.circle`, `pygame.draw.polygon`...).
Difference on the site: no window and no `while running:` loop. Register a function with
`on_frame(f)`; the page calls it about 30 times per second.
"""

WIDTH = 600
HEIGHT = 400
_cmds = []
_frame_cb = None


def _reset():
    global _frame_cb, WIDTH, HEIGHT
    _cmds.clear()
    _frame_cb = None
    WIDTH, HEIGHT = 600, 400


def _take():
    out = list(_cmds)
    _cmds.clear()
    return out


def size(width, height):
    """Set the canvas size in pixels."""
    global WIDTH, HEIGHT
    WIDTH, HEIGHT = int(width), int(height)


def clear(color="#0d1021"):
    """Fill the whole canvas (pygame: screen.fill(color))."""
    _cmds.append(["clear", str(color)])


def circle(x, y, radius, color="white", fill=True):
    """pygame: pygame.draw.circle(screen, color, (x, y), radius)."""
    _cmds.append(["circle", float(x), float(y), float(radius), str(color), bool(fill)])


def line(x1, y1, x2, y2, color="white", width=1):
    """pygame: pygame.draw.line(screen, color, (x1, y1), (x2, y2), width)."""
    _cmds.append(["line", float(x1), float(y1), float(x2), float(y2), str(color), float(width)])


def polygon(points, color="white", fill=True):
    """pygame: pygame.draw.polygon(screen, color, points)."""
    pts = [[float(p[0]), float(p[1])] for p in points]
    _cmds.append(["polygon", pts, str(color), bool(fill)])


def rect(x, y, width, height, color="white", fill=True):
    """pygame: pygame.draw.rect(screen, color, (x, y, w, h))."""
    _cmds.append(["rect", float(x), float(y), float(width), float(height), str(color), bool(fill)])


def text(x, y, message, color="white", size=14):
    _cmds.append(["text", float(x), float(y), str(message), str(color), int(size)])


def on_frame(function):
    """Register the function called at every animation frame."""
    global _frame_cb
    _frame_cb = function


def run():
    """Kept for compatibility: on the site the page drives the frames."""
    return None

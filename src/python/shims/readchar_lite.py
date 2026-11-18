"""readchar_lite — keyboard keys sent by the page (PyArcade shim).

Real-life equivalent: the `readchar` package (`readchar.readkey()`, `readchar.key.UP`).
Difference on the site: keys come from the page (arrows / ZQSD / WASD), and the program
is replayed from the start with the same random seed each time you press a key.
"""


class key:
    UP = "\x1b[A"
    DOWN = "\x1b[B"
    RIGHT = "\x1b[C"
    LEFT = "\x1b[D"
    ENTER = "\r"
    SPACE = " "
    ESC = "\x1b"
    BACKSPACE = "\x7f"


_queue = []


def _reset():
    _queue.clear()


def readkey():
    """Wait for one key and return it (string)."""
    if _queue:
        return _queue.pop(0)
    import runner

    raise runner.NeedKey()


readchar = readkey

"""rich_lite — coloured console output (PyArcade shim).

Real-life equivalent: the `rich` package
(`from rich.console import Console`, `from rich.table import Table`, `from rich.text import Text`).
Difference on the site: everything is in one module (`from rich_lite import Console, Table, Text`)
and the console is drawn in the page. Markup is the same: "[bold green]OK[/]", "[black on yellow] A [/]".
"""

import sys

MARK = "\x1b[R]"
CLEAR = "\x1b[CLEAR]"


def _reset():
    return None


def escape(text):
    """Escape square brackets so they are not read as markup."""
    return str(text).replace("[", "\\[")


def _plain(markup):
    """Remove markup tags: '[bold]hi[/]' -> 'hi'."""
    out = []
    i = 0
    s = str(markup)
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s) and s[i + 1] == "[":
            out.append("[")
            i += 2
            continue
        if c == "[":
            j = s.find("]", i)
            if j != -1:
                i = j + 1
                continue
        out.append(c)
        i += 1
    return "".join(out)


class Text:
    """Styled text: Text("A", style="black on green")."""

    def __init__(self, text="", style=""):
        self._parts = []
        if text:
            self._parts.append((str(text), style))

    def append(self, text, style=""):
        self._parts.append((str(text), style))
        return self

    @property
    def plain(self):
        return "".join(t for t, _ in self._parts)

    def __len__(self):
        return len(self.plain)

    def __str__(self):
        return "".join(f"[{st}]{escape(t)}[/]" if st else escape(t) for t, st in self._parts)

    __repr__ = __str__


def _markup(obj):
    if isinstance(obj, Text):
        return str(obj)
    return str(obj)


class Table:
    def __init__(self, title=None, show_header=True, show_lines=False, box=True, **kwargs):
        self.title = title
        self.show_header = show_header
        self.show_lines = show_lines
        self.box = box
        self.columns = []
        self.rows = []

    def add_column(self, header="", justify="center", style="", width=None, **kwargs):
        self.columns.append({"header": str(header), "justify": justify, "style": style, "width": width})

    def add_row(self, *cells, **kwargs):
        self.rows.append([_markup(c) for c in cells])

    def _lines(self):
        ncol = max(len(self.columns), max((len(r) for r in self.rows), default=0))
        cols = self.columns + [{"header": "", "justify": "center", "style": "", "width": None}] * (ncol - len(self.columns))
        widths = []
        for i in range(ncol):
            w = len(_plain(cols[i]["header"])) if self.show_header else 0
            for r in self.rows:
                if i < len(r):
                    w = max(w, len(_plain(r[i])))
            widths.append(cols[i]["width"] or w)

        def cell(text, i):
            pad = widths[i] - len(_plain(text))
            just = cols[i]["justify"]
            if just == "left":
                left, right = 0, pad
            elif just == "right":
                left, right = pad, 0
            else:
                left, right = pad // 2, pad - pad // 2
            body = " " * left + text + " " * right
            if cols[i]["style"]:
                body = f"[{cols[i]['style']}]{body}[/]"
            return " " + body + " "

        sep = "│" if self.box else " "
        top = "┌" + "┬".join("─" * (w + 2) for w in widths) + "┐"
        mid = "├" + "┼".join("─" * (w + 2) for w in widths) + "┤"
        bot = "└" + "┴".join("─" * (w + 2) for w in widths) + "┘"
        lines = []
        if self.title:
            total = sum(widths) + 3 * ncol + 1
            t = str(self.title)
            lines.append(" " * max(0, (total - len(_plain(t))) // 2) + f"[italic]{t}[/]")
        if self.box:
            lines.append(top)
        if self.show_header and any(c["header"] for c in cols):
            lines.append(sep + sep.join(cell(f"[bold]{c['header']}[/]", i) for i, c in enumerate(cols)) + sep)
            if self.box:
                lines.append(mid)
        for k, r in enumerate(self.rows):
            r = r + [""] * (ncol - len(r))
            lines.append(sep + sep.join(cell(r[i], i) for i in range(ncol)) + sep)
            if self.show_lines and self.box and k < len(self.rows) - 1:
                lines.append(mid)
        if self.box:
            lines.append(bot)
        return lines


class Panel:
    def __init__(self, renderable, title=None, **kwargs):
        self.renderable = renderable
        self.title = title

    def _lines(self):
        inner = _render_lines(self.renderable)
        w = max([len(_plain(x)) for x in inner] + [len(str(self.title or "")) + 2])
        head = "─" * (w + 2)
        if self.title:
            t = f" {self.title} "
            head = t.center(w + 2, "─")
        lines = ["╭" + head + "╮"]
        for x in inner:
            lines.append("│ " + x + " " * (w - len(_plain(x))) + " │")
        lines.append("╰" + "─" * (w + 2) + "╯")
        return lines


def _render_lines(obj):
    if hasattr(obj, "_lines"):
        return obj._lines()
    return _markup(obj).split("\n")


class Console:
    def __init__(self, **kwargs):
        pass

    def print(self, *objects, sep=" ", end="\n", style=None, **kwargs):
        chunks = []
        for o in objects:
            if hasattr(o, "_lines"):
                if chunks:
                    self._emit(sep.join(chunks), style)
                    chunks = []
                for ln in o._lines():
                    self._emit(ln, style)
            else:
                chunks.append(_markup(o))
        if chunks or not objects:
            text = sep.join(chunks)
            for ln in text.split("\n"):
                self._emit(ln, style)

    def _emit(self, line, style):
        if style:
            line = f"[{style}]{line}[/]"
        sys.stdout.write(MARK + line + "\n")

    def clear(self):
        sys.stdout.write(CLEAR + "\n")

    def rule(self, title=""):
        self._emit(f"──── {title} ────" if title else "─" * 30, "dim")

    def input(self, prompt=""):
        return input(_plain(prompt))


_default = Console()


def print(*objects, **kwargs):  # noqa: A001 - mirrors `from rich import print`
    _default.print(*objects, **kwargs)

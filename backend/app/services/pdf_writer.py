"""Minimal pure-Python PDF generator (no external dependencies).

Implements a small, deterministic subset of PDF 1.4 using the 14 standard
Type1 fonts (no embedding required). Supports multiple pages, fonts, text,
filled rectangles and lines with top-down coordinates (A4 portrait).
"""

import zlib

PAGE_W = 595.28  # A4 portrait width (pt)
PAGE_H = 841.89  # A4 portrait height (pt)

_FONTS = {
    "Helvetica": ("/F1", "Helvetica", 0.50),
    "Helvetica-Bold": ("/F2", "Helvetica-Bold", 0.55),
}

_ANSI = {0: "", 3: "Ç", 4: "é", 6: "ä", 7: "Ä", 8: "È", 9: "é", 10: "ê", 11: "ë",
         12: "È", 13: "ï", 14: "î", 15: "Ì", 16: "Ä", 17: "À", 19: "É", 20: "æ",
         21: "Æ", 22: "ô", 23: "ö", 24: "ò", 25: "û", 26: "ù", 27: "ÿ", 28: "Ö",
         30: "Ì", 31: "Ü", 32: "¢", 33: "£", 34: "¥", 36: "ƒ", 37: "á", 38: "í",
         39: "ó", 40: "ú", 41: "ñ", 42: "Ñ", 43: "ª", 44: "º", 45: "¿", 46: "⌐",
         47: "¬", 48: "½", 49: "¼", 50: "¡", 51: "«", 52: "»", 92: "Æ", 94: "×",
         95: "Þ", 96: "Ÿ", 99: "æ", 101: "Ə", 102: "ð", 104: "đ", 105: "Đ", 106: "Ĳ",
         107: "ĳ", 109: "Ŀ", 110: "ŀ", 111: "Ł", 112: "ł", 113: "Œ", 114: "œ",
         116: "Ŝ", 118: "Š", 119: "š", 121: "Ť", 122: "Ŵ", 123: "Ŷ", 124: "Ž",
         126: "ž", 160: "€"}


def _escape(s: str) -> str:
    out: list[str] = []
    for ch in s:
        code = ord(ch)
        if 32 <= code <= 126:
            if ch in ("(", ")", "\\"):
                out.append("\\" + ch)
            else:
                out.append(ch)
        elif code in _ANSI:
            out.append(_ANSI[code])
        else:
            out.append("?")
    return "".join(out)


class _Page:
    def __init__(self) -> None:
        self.ops: list[str] = []


class PdfWriter:
    """Tiny vector-drawing PDF canvas with top-down coordinates."""

    def __init__(self) -> None:
        self.pages: list[_Page] = [_Page()]
        self._font_key = "/F1"
        self._base = "Helvetica"
        self._font_size = 12.0
        self._fill = "0 0 0"
        self._stroke = "0 0 0"

    # ------------------------------------------------------------------
    # State
    # ------------------------------------------------------------------

    @property
    def _page(self) -> _Page:
        return self.pages[-1]

    def set_font(self, name: str, size: float) -> None:
        key, base, _ = _FONTS.get(name, _FONTS["Helvetica"])
        self._font_key = key
        self._base = base
        self._font_size = size

    def set_text_color(self, r: float, g: float, b: float) -> None:
        self._fill = f"{r:.3f} {g:.3f} {b:.3f}"

    def set_fill_color(self, r: float, g: float, b: float) -> None:
        self._fill = f"{r:.3f} {g:.3f} {b:.3f}"

    def set_stroke_color(self, r: float, g: float, b: float) -> None:
        self._stroke = f"{r:.3f} {g:.3f} {b:.3f}"

    # ------------------------------------------------------------------
    # Primitives
    # ------------------------------------------------------------------

    def text(self, x: float, y: float, s: str) -> None:
        yy = PAGE_H - y
        self._page.ops.append(
            f"BT {self._font_key} {self._font_size:.2f} Tf {self._fill} rg "
            f"{x:.2f} {yy:.2f} Td ({_escape(s)}) Tj ET"
        )

    def rect(self, x: float, y: float, w: float, h: float) -> None:
        yy = PAGE_H - (y + h)
        self._page.ops.append(
            f"{self._fill} rg {x:.2f} {yy:.2f} {w:.2f} {h:.2f} re f"
        )

    def line(self, x1: float, y1: float, x2: float, y2: float) -> None:
        yy1 = PAGE_H - y1
        yy2 = PAGE_H - y2
        self._page.ops.append(
            f"{self._stroke} RG {x1:.2f} {yy1:.2f} m {x2:.2f} {yy2:.2f} l S"
        )

    def new_page(self) -> None:
        self.pages.append(_Page())
        self.set_font("Helvetica", 12.0)
        self.set_fill_color(0, 0, 0)
        self.set_stroke_color(0, 0, 0)

    def text_width(self, s: str) -> float:
        _, _, avg = _FONTS.get(self._base if self._base in _FONTS else "Helvetica", (None, self._base, 0.50))
        return len(s) * self._font_size * avg

    # ------------------------------------------------------------------
    # Serialization
    # ------------------------------------------------------------------

    @staticmethod
    def _stream(ops: list[str]) -> bytes:
        return zlib.compress("\n".join(ops).encode("latin-1", errors="replace"))

    def build(self) -> bytes:
        streams = [self._stream(p.ops) for p in self.pages]
        count = len(self.pages)
        num_objs = 4 + 2 * count
        body: list[bytes] = [b""] * (num_objs + 1)

        body[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
        kids = b" ".join(f"{6 + 2 * i} 0 R".encode() for i in range(count))
        body[2] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, count)
        body[3] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
        body[4] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"

        for i, stream in enumerate(streams):
            content_id = 5 + 2 * i
            page_id = 6 + 2 * i
            body[content_id] = (
                b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
            )
            body[page_id] = (
                b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] "
                b"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
                b"/Contents %d 0 R >>" % (int(PAGE_W), int(PAGE_H), content_id)
            )

        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = [0] * (num_objs + 1)
        for i in range(1, num_objs + 1):
            offsets[i] = len(out)
            out += b"%d 0 obj\n" % i
            out += body[i] + b"\nendobj\n"

        xref_pos = len(out)
        out += b"xref\n0 %d\n" % (num_objs + 1)
        out += b"0000000000 65535 f \n"
        for i in range(1, num_objs + 1):
            out += b"%010d 00000 n \n" % offsets[i]
        out += (
            b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n"
            % (num_objs + 1, xref_pos)
        )
        return bytes(out)

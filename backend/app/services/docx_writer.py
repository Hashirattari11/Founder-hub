"""Minimal pure-Python DOCX writer (no external dependencies).

Produces a valid Office Open XML .docx (Word 2007+) containing headings,
paragraphs, bullet lists and simple tables. The package is a ZIP archive of
the standard OOXML parts.
"""
from __future__ import annotations

import io
import zipfile


def _esc(s: str) -> str:
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


_CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
"""

_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

_DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

_STYLES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="64"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:rPr><w:sz w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="320" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:ind w:left="480"/></w:pPr>
  </w:style>
</w:styles>
"""


class DocxWriter:
    """Tiny OOXML document builder."""

    def __init__(self) -> None:
        self.body: list[str] = []

    def _p(self, text: str, style: str | None = None) -> None:
        style_xml = f'<w:pStyle w:val="{style}"/>' if style else ""
        self.body.append(
            f'<w:p><w:pPr>{style_xml}</w:pPr>'
            f'<w:r><w:t xml:space="preserve">{_esc(text)}</w:t></w:r></w:p>'
        )

    def add_title(self, text: str) -> None:
        self._p(text, "Title")

    def add_subtitle(self, text: str) -> None:
        self._p(text, "Subtitle")

    def add_heading(self, text: str, level: int = 1) -> None:
        self._p(text, "Heading1" if level == 1 else "Heading2")

    def add_paragraph(self, text: str) -> None:
        for chunk in str(text).split("\n"):
            self._p(chunk)

    def add_bullets(self, items: list[str]) -> None:
        for item in items:
            self._p(f"\u2022  {item}", "ListParagraph")

    def add_table(self, headers: list[str], rows: list[list[str]]) -> None:
        def cell(text: str) -> str:
            return (
                '<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>'
                f'<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2" w:fill2="F2F2F2"/></w:tcPr>'
                f'<w:p><w:r><w:t xml:space="preserve">{_esc(text)}</w:t></w:r></w:p></w:tc>'
            )

        rows_xml: list[str] = []
        for row in rows:
            cells = "".join(cell(c) for c in row)
            rows_xml.append(f"<w:tr>{cells}</w:tr>")

        # Strip shading on header row for a subtle distinction is overkill here.
        table = (
            '<w:tbl><w:tblPr><w:tblBorders>'
            '<w:top w:val="single" w:sz="4" w:color="CCCCCC"/>'
            '<w:left w:val="single" w:sz="4" w:color="CCCCCC"/>'
            '<w:bottom w:val="single" w:sz="4" w:color="CCCCCC"/>'
            '<w:right w:val="single" w:sz="4" w:color="CCCCCC"/>'
            '<w:insideH w:val="single" w:sz="4" w:color="CCCCCC"/>'
            '<w:insideV w:val="single" w:sz="4" w:color="CCCCCC"/>'
            "</w:tblBorders></w:tblPr>"
            + "".join(rows_xml)
            + "</w:tbl>"
        )
        self.body.append(table)
        self._p("")

    def add_page_break(self) -> None:
        self.body.append('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')

    def build(self) -> bytes:
        document = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body>"
            + "".join(self.body)
            + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
            '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>'
            "</w:body></w:document>"
        )

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", _CONTENT_TYPES)
            zf.writestr("_rels/.rels", _RELS)
            zf.writestr("word/_rels/document.xml.rels", _DOC_RELS)
            zf.writestr("word/styles.xml", _STYLES)
            zf.writestr("word/document.xml", document)
        return buf.getvalue()

from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "docs" / "STUDENT_USER_MANUAL_ZH.md"
OUTPUT = ROOT / "docs" / "STUDENT_USER_MANUAL_ZH.pdf"
FONT_PATHS = [
    Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
    Path("/System/Library/Fonts/STHeiti Light.ttc"),
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
]
FONT_NAME = "StudentManualCJK"


def register_font() -> None:
    for font_path in FONT_PATHS:
        if font_path.exists():
            pdfmetrics.registerFont(TTFont(FONT_NAME, str(font_path)))
            return
    raise FileNotFoundError("No supported CJK font found for PDF generation.")


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ManualTitle",
            parent=styles["Title"],
            fontName=FONT_NAME,
            fontSize=24,
            leading=30,
            textColor=colors.HexColor("#1E3A5F"),
            alignment=TA_CENTER,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualMeta",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=10.5,
            leading=16,
            textColor=colors.HexColor("#64748B"),
            alignment=TA_CENTER,
            spaceAfter=3,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualH2",
            parent=styles["Heading1"],
            fontName=FONT_NAME,
            fontSize=16,
            leading=22,
            textColor=colors.HexColor("#1E3A5F"),
            spaceBefore=12,
            spaceAfter=6,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualH3",
            parent=styles["Heading2"],
            fontName=FONT_NAME,
            fontSize=12.5,
            leading=18,
            textColor=colors.HexColor("#0F172A"),
            spaceBefore=8,
            spaceAfter=4,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualBody",
            parent=styles["BodyText"],
            fontName=FONT_NAME,
            fontSize=10.5,
            leading=18,
            textColor=colors.HexColor("#334155"),
            spaceAfter=5,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualBullet",
            parent=styles["BodyText"],
            fontName=FONT_NAME,
            fontSize=10.5,
            leading=18,
            leftIndent=12,
            firstLineIndent=-10,
            textColor=colors.HexColor("#334155"),
            spaceAfter=3,
            wordWrap="CJK",
        )
    )
    styles.add(
        ParagraphStyle(
            name="ManualFooter",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=8.5,
            leading=10,
            textColor=colors.HexColor("#94A3B8"),
            alignment=TA_RIGHT,
        )
    )
    return styles


def normalize_inline(text: str) -> str:
    text = escape(text.strip())
    text = re.sub(r"`([^`]+)`", r"<font color='#1E3A5F'>\1</font>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def parse_markdown_blocks(content: str):
    lines = content.splitlines()
    i = 0
    blocks: list[tuple[str, object]] = []

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        stripped = line.strip()

        if not stripped:
            i += 1
            continue

        if stripped.startswith("# "):
            blocks.append(("title", stripped[2:].strip()))
            i += 1
            continue

        if stripped.startswith("## "):
            blocks.append(("h2", stripped[3:].strip()))
            i += 1
            continue

        if stripped.startswith("### "):
            blocks.append(("h3", stripped[4:].strip()))
            i += 1
            continue

        if re.match(r"^[-] ", stripped):
            items = []
            while i < len(lines):
                candidate = lines[i].strip()
                if not candidate or not re.match(r"^[-] ", candidate):
                    break
                items.append(candidate[2:].strip())
                i += 1
            blocks.append(("ul", items))
            continue

        if re.match(r"^\d+\. ", stripped):
            items = []
            while i < len(lines):
                candidate = lines[i].strip()
                if not candidate or not re.match(r"^\d+\. ", candidate):
                    break
                items.append(candidate)
                i += 1
            blocks.append(("ol", items))
            continue

        paragraph_lines = [stripped]
        i += 1
        while i < len(lines):
            candidate = lines[i].strip()
            if not candidate:
                break
            if candidate.startswith("#") or re.match(r"^[-] ", candidate) or re.match(r"^\d+\. ", candidate):
                break
            paragraph_lines.append(candidate)
            i += 1
        blocks.append(("p", " ".join(paragraph_lines)))

    return blocks


def build_story(blocks, styles):
    story = []
    title_used = False

    for block_type, value in blocks:
        if block_type == "title":
            if title_used:
                story.append(PageBreak())
            story.append(Spacer(1, 30 * mm))
            story.append(Paragraph(normalize_inline(str(value)), styles["ManualTitle"]))
            story.append(Spacer(1, 4 * mm))
            title_used = True
            continue

        if block_type == "h2":
            story.append(Paragraph(normalize_inline(str(value)), styles["ManualH2"]))
            continue

        if block_type == "h3":
            story.append(Paragraph(normalize_inline(str(value)), styles["ManualH3"]))
            continue

        if block_type == "p":
            style_name = "ManualMeta" if not title_used else "ManualBody"
            story.append(Paragraph(normalize_inline(str(value)), styles[style_name]))
            continue

        if block_type == "ul":
            for item in value:  # type: ignore[assignment]
                story.append(Paragraph(f"• {normalize_inline(item)}", styles["ManualBullet"]))
            story.append(Spacer(1, 1 * mm))
            continue

        if block_type == "ol":
            for item in value:  # type: ignore[assignment]
                story.append(Paragraph(normalize_inline(item), styles["ManualBullet"]))
            story.append(Spacer(1, 1 * mm))
            continue

    return story


def draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_NAME, 8.5)
    canvas.setFillColor(colors.HexColor("#94A3B8"))
    canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, 10 * mm, f"学生端用户手册  |  第 {canvas.getPageNumber()} 页")
    canvas.restoreState()


def main() -> None:
    register_font()
    styles = build_styles()
    content = SOURCE.read_text(encoding="utf-8")
    blocks = parse_markdown_blocks(content)

    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="学生端用户手册",
        author="Codex",
    )

    story = build_story(blocks, styles)
    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)


if __name__ == "__main__":
    main()

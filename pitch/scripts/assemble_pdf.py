"""Assemble slide-*.png screenshots into a 16:9 PDF deck.
Usage: python assemble_pdf.py <shots_dir> <out.pdf>"""
import os
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

shots = sys.argv[1]
out = sys.argv[2]
W, H = 960, 540  # 16:9 page in points

c = canvas.Canvas(out, pagesize=(W, H))
c.setTitle("VeritasCore — Audit Deck")
c.setAuthor("VeritasCore — AMD Developer Hackathon Act II")
c.setSubject("Real-time AI behavioral auditing on AMD Instinct MI300X")

for i in range(1, 9):
    c.drawImage(ImageReader(os.path.join(shots, f"slide-{i}.png")), 0, 0, width=W, height=H)
    c.showPage()

c.save()
print("PDF written:", out, os.path.getsize(out), "bytes")

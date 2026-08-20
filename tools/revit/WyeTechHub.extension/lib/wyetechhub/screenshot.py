# -*- coding: utf-8 -*-
"""Click-drag a region of the screen and return PNG bytes."""

from System import Convert
from System.Drawing import Bitmap, Color, Graphics, Pen, Rectangle, SolidBrush
from System.Drawing.Imaging import ImageFormat
from System.IO import MemoryStream
from System.Threading import Thread
from System.Windows.Forms import (
    Application,
    Cursors,
    DialogResult,
    Form,
    FormBorderStyle,
    FormStartPosition,
    Keys,
    MouseButtons,
    PaintEventHandler,
    SystemInformation,
)


class RegionOverlay(Form):
    def __init__(self):
        Form.__init__(self)
        bounds = SystemInformation.VirtualScreen
        self.FormBorderStyle = FormBorderStyle.None
        self.StartPosition = FormStartPosition.Manual
        self.Bounds = bounds
        self.TopMost = True
        self.ShowInTaskbar = False
        self.Opacity = 0.18
        self.BackColor = Color.Black
        self.Cursor = Cursors.Cross
        self.DoubleBuffered = True
        self.KeyPreview = True
        self._start = None
        self._current = None
        self.Selection = None

        self.MouseDown += self._on_down
        self.MouseMove += self._on_move
        self.MouseUp += self._on_up
        self.KeyDown += self._on_key
        self.Paint += PaintEventHandler(self._on_paint)

    def _on_key(self, sender, args):
        if args.KeyCode == Keys.Escape:
            self.DialogResult = DialogResult.Cancel
            self.Close()

    def _on_down(self, sender, args):
        if args.Button == MouseButtons.Left:
            self._start = args.Location
            self._current = args.Location

    def _on_move(self, sender, args):
        if self._start is not None:
            self._current = args.Location
            self.Invalidate()

    def _on_up(self, sender, args):
        if self._start is None or self._current is None:
            return
        x = min(self._start.X, self._current.X)
        y = min(self._start.Y, self._current.Y)
        w = abs(self._current.X - self._start.X)
        h = abs(self._current.Y - self._start.Y)
        if w < 8 or h < 8:
            self.DialogResult = DialogResult.Cancel
            self.Close()
            return
        self.Selection = Rectangle(self.Left + x, self.Top + y, w, h)
        self.DialogResult = DialogResult.OK
        self.Close()

    def _on_paint(self, sender, args):
        if self._start is None or self._current is None:
            return
        x = min(self._start.X, self._current.X)
        y = min(self._start.Y, self._current.Y)
        w = abs(self._current.X - self._start.X)
        h = abs(self._current.Y - self._start.Y)
        rect = Rectangle(x, y, w, h)
        g = args.Graphics
        g.FillRectangle(SolidBrush(Color.FromArgb(60, 255, 255, 255)), rect)
        g.DrawRectangle(Pen(Color.White, 2), rect)


def capture_region_png_base64():
    overlay = RegionOverlay()
    result = overlay.ShowDialog()
    selection = overlay.Selection
    overlay.Dispose()
    if result != DialogResult.OK or selection is None:
        return None

    Application.DoEvents()
    Thread.Sleep(80)

    bmp = Bitmap(selection.Width, selection.Height)
    g = Graphics.FromImage(bmp)
    try:
        g.CopyFromScreen(selection.Left, selection.Top, 0, 0, bmp.Size)
    finally:
        g.Dispose()

    stream = MemoryStream()
    try:
        bmp.Save(stream, ImageFormat.Png)
        return Convert.ToBase64String(stream.ToArray())
    finally:
        stream.Dispose()
        bmp.Dispose()

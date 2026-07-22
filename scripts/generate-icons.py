#!/usr/bin/env python3
"""生成 ASMRoner 图标资产。

注意:主图标 apps/desktop/build/appicon.png 是手工设计稿(月 + 声波),
本脚本不再生成它,只在其基础上派生:
- apps/desktop/tray_icon.png  44x44 菜单栏模板图标(亮部笔触 → 黑色剪影)

需要 Pillow:python3 -m pip install Pillow
"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
APPICON = ROOT / "apps/desktop/build/appicon.png"
TRAY_OUT = ROOT / "apps/desktop/tray_icon.png"


def make_tray_icon():
    """从主图标提取亮色笔触,加粗一档,生成黑色剪影模板图标。"""
    sq = Image.open(APPICON).convert("RGB")
    s = 44
    lum = sq.convert("L")
    bbox = lum.point(lambda p: 255 if p > 110 else 0).getbbox()
    art = lum.crop(bbox)
    art.thumbnail((34, 34), Image.LANCZOS)
    alpha = art.point(lambda p: 255 if p > 100 else 0).filter(ImageFilter.MaxFilter(3))
    canvas = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    off = ((s - art.width) // 2, (s - art.height) // 2)
    canvas.paste(Image.new("RGBA", art.size, (0, 0, 0, 255)), off, alpha)
    canvas.save(TRAY_OUT)
    print(f"wrote {TRAY_OUT}")


if __name__ == "__main__":
    make_tray_icon()

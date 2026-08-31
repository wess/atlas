// Renders a placeholder app icon — a letter on a gradient squircle — to a
// 1024x1024 PNG. Pure CoreGraphics, no third-party deps, so it runs anywhere
// Swift does (a dev machine and a macOS CI runner alike).
//
// It exists so a freshly scaffolded app has an icon that is recognisably its
// own from the first build. Replace it with the real artwork; scripts/icon.sh
// does not care where the master PNG came from.
//
// Usage: swift scripts/icon.swift out.png [letter] [#hexaccent]
import CoreGraphics
import CoreText
import Foundation
import ImageIO

let args = CommandLine.arguments
let outPath = args.count > 1 ? args[1] : "assets/icon.png"
let letter = args.count > 2 ? String(args[2].prefix(1)).uppercased() : "A"
let accentHex = args.count > 3 ? args[3] : "#4C6EF5"

let dim = 1024
let space = CGColorSpaceCreateDeviceRGB()

func color(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> CGColor {
  CGColor(colorSpace: space, components: [r, g, b, a])!
}

/// #rrggbb to a CGColor, falling back to a neutral indigo on anything odd.
func hex(_ s: String, _ scale: Double = 1) -> CGColor {
  var text = s.hasPrefix("#") ? String(s.dropFirst()) : s
  if text.count != 6 { text = "4C6EF5" }
  let value = UInt32(text, radix: 16) ?? 0x4C6EF5
  let r = Double((value >> 16) & 0xFF) / 255 * scale
  let g = Double((value >> 8) & 0xFF) / 255 * scale
  let b = Double(value & 0xFF) / 255 * scale
  return color(min(r, 1), min(g, 1), min(b, 1))
}

guard let ctx = CGContext(
  data: nil, width: dim, height: dim, bitsPerComponent: 8, bytesPerRow: 0,
  space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else { fatalError("could not create context") }

let full = CGFloat(dim)
ctx.clear(CGRect(x: 0, y: 0, width: full, height: full))

// The body, inset so the system shadow has room. The corner radius follows
// Apple's ~0.224 ratio of the body size, which is what makes it read as a
// macOS icon rather than a rounded square.
let margin: CGFloat = 88
let body = CGRect(x: margin, y: margin, width: full - margin * 2, height: full - margin * 2)
let radius = body.width * 0.2237
let squircle = CGPath(roundedRect: body, cornerWidth: radius, cornerHeight: radius, transform: nil)

ctx.saveGState()
ctx.addPath(squircle)
ctx.clip()
let gradient = CGGradient(
  colorsSpace: space,
  colors: [hex(accentHex, 1.25), hex(accentHex, 0.55)] as CFArray,
  locations: [0, 1]
)!
ctx.drawLinearGradient(
  gradient, start: CGPoint(x: 0, y: full), end: CGPoint(x: 0, y: 0), options: []
)
// A soft sheen near the top, for a little depth.
let sheen = CGGradient(
  colorsSpace: space,
  colors: [color(1, 1, 1, 0.14), color(1, 1, 1, 0)] as CFArray,
  locations: [0, 1]
)!
ctx.drawRadialGradient(
  sheen,
  startCenter: CGPoint(x: full / 2, y: full * 0.86), startRadius: 0,
  endCenter: CGPoint(x: full / 2, y: full * 0.86), endRadius: full * 0.6,
  options: []
)
ctx.restoreGState()

// A hairline highlight along the top rim.
ctx.saveGState()
ctx.addPath(squircle)
ctx.setStrokeColor(color(1, 1, 1, 0.18))
ctx.setLineWidth(3)
ctx.strokePath()
ctx.restoreGState()

// The letter, centred optically rather than by bounding box: glyph metrics
// include ascender space the eye does not see, so a mathematically centred
// capital sits visibly low.
// CoreText attribute keys rather than the AppKit ones, so this stays a
// dependency-free script rather than pulling in a UI framework to draw a letter.
let font = CTFontCreateWithName("Helvetica-Bold" as CFString, body.width * 0.52, nil)
let attributes: [CFString: Any] = [
  kCTFontAttributeName: font,
  kCTForegroundColorAttributeName: color(1, 1, 1, 0.95),
]
let attributed = CFAttributedStringCreate(nil, letter as CFString, attributes as CFDictionary)!
let line = CTLineCreateWithAttributedString(attributed)
let bounds = CTLineGetBoundsWithOptions(line, .useOpticalBounds)
ctx.textPosition = CGPoint(
  x: body.midX - bounds.width / 2 - bounds.minX,
  y: body.midY - bounds.height / 2 - bounds.minY
)
CTLineDraw(line, ctx)

guard let image = ctx.makeImage() else { fatalError("could not render icon") }
let url = URL(fileURLWithPath: outPath)
try? FileManager.default.createDirectory(
  at: url.deletingLastPathComponent(), withIntermediateDirectories: true
)
guard let dest = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil)
else { fatalError("could not open \(outPath)") }
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("could not write \(outPath)") }
print("wrote \(outPath)")

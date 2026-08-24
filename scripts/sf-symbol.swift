// Render a genuine SF Symbol with AppKit to a transparent PNG (black glyph), e.g.
//   swift scripts/sf-symbol.swift person.crop.circle.fill 24 out/person [weight] [scale]
// → out/person.png at <scale>x (default 16). Use it as a CSS mask via <SFSymbol name=…> (src/components/SFSymbol.tsx).
import AppKit
let args = CommandLine.arguments
guard args.count >= 4 else { print("usage: sf-symbol.swift <name> <pointSize> <outBase> [weight] [scale]"); exit(1) }
let name = args[1], size = CGFloat(Double(args[2]) ?? 24), base = args[3]
let weights: [String: NSFont.Weight] = ["ultralight": .ultraLight, "thin": .thin, "light": .light, "regular": .regular, "medium": .medium, "semibold": .semibold, "bold": .bold, "heavy": .heavy, "black": .black]
let weight = weights[args.count > 4 ? args[4] : "regular"] ?? .regular
let config = NSImage.SymbolConfiguration(pointSize: size, weight: weight, scale: .medium)
guard let img = NSImage(systemSymbolName: name, accessibilityDescription: nil)?.withSymbolConfiguration(config) else { print("no such symbol: \(name)"); exit(2) }
let rect = CGRect(origin: .zero, size: img.size)
// PNG (transparent, black glyph)
let scale = CGFloat(Double(args.count > 5 ? args[5] : "16") ?? 16)
let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(rect.width * scale), pixelsHigh: Int(rect.height * scale), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
rep.size = rect.size
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
img.draw(in: rect)
NSGraphicsContext.restoreGraphicsState()
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: base + ".png"))
print("\(name) size=\(img.size.width)x\(img.size.height)")

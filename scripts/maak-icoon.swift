// Tekent het app-icoon van Hrvatski: een stickertje met de šahovnica op stipjespapier,
// in de Krabbel-stijl (inktrand, harde schaduw, een fractie scheef).
// Gebruik: swift scripts/maak-icoon.swift uit.png [--vol]
//   --vol  een vol vierkant zonder afgeronde tegel (voor iOS en Android, die zelf afronden)
import AppKit

let maat: CGFloat = 1024
guard let uitPad = CommandLine.arguments.dropFirst().first else { print("geef een uitvoerbestand op"); exit(1) }
let vol = CommandLine.arguments.contains("--vol")

let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(maat), pixelsHigh: Int(maat), bitsPerSample: 8,
                           samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
let ctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = ctx
let cg = ctx.cgContext

func kleur(_ hex: UInt32, _ a: CGFloat = 1) -> NSColor {
    NSColor(red: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}
let inkt = kleur(0x1b1a22)

// Papier: een afgeronde tegel met dunne inktrand (macOS-iconen laten een marge rondom).
let tegel = vol ? NSRect(x: 0, y: 0, width: maat, height: maat) : NSRect(x: 100, y: 100, width: 824, height: 824)
let papier = vol ? NSBezierPath(rect: tegel) : NSBezierPath(roundedRect: tegel, xRadius: 190, yRadius: 190)
kleur(0xfbfaf7).setFill(); papier.fill()

// Stipjes
cg.saveGState(); papier.addClip()
kleur(0x1b1a22, 0.12).setFill()
var y: CGFloat = 130
while y < 930 { var x: CGFloat = 130; while x < 930 { NSBezierPath(ovalIn: NSRect(x: x, y: y, width: 7, height: 7)).fill(); x += 44 }; y += 44 }
cg.restoreGState()

if !vol { inkt.setStroke(); papier.lineWidth = 22; papier.stroke() }

// De sticker: een gedraaid dambord 5x5 met harde schaduw.
cg.saveGState()
cg.translateBy(x: maat / 2, y: maat / 2)
cg.rotate(by: -6 * .pi / 180)
let s: CGFloat = vol ? 520 : 500
let kader = NSRect(x: -s / 2, y: -s / 2, width: s, height: s)
let schaduw = kader.offsetBy(dx: 26, dy: -26)
inkt.setFill(); NSBezierPath(roundedRect: schaduw, xRadius: 70, yRadius: 70).fill()

let vorm = NSBezierPath(roundedRect: kader, xRadius: 70, yRadius: 70)
cg.saveGState(); vorm.addClip()
let cel = s / 5
for r in 0..<5 { for k in 0..<5 {
    (((r + k) % 2 == 0) ? kleur(0xe63946) : NSColor.white).setFill()
    NSRect(x: kader.minX + CGFloat(k) * cel, y: kader.minY + CGFloat(r) * cel, width: cel + 1, height: cel + 1).fill()
} }
cg.restoreGState()
inkt.setStroke(); vorm.lineWidth = 22; vorm.stroke()
cg.restoreGState()

// Een gele glinstering rechtsboven.
func ster(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat, vul: NSColor) {
    let p = NSBezierPath()
    for i in 0..<8 {
        let hoek = CGFloat(i) * .pi / 4
        let straal = i % 2 == 0 ? r : r * 0.32
        let punt = NSPoint(x: cx + cos(hoek) * straal, y: cy + sin(hoek) * straal)
        i == 0 ? p.move(to: punt) : p.line(to: punt)
    }
    p.close(); vul.setFill(); p.fill(); inkt.setStroke(); p.lineWidth = 12; p.lineJoinStyle = .round; p.stroke()
}
ster(vol ? 745 : 770, vol ? 765 : 790, 92, vul: kleur(0xffe45c))

NSGraphicsContext.current = nil
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: uitPad))

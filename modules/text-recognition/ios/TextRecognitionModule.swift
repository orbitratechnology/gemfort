import ExpoModulesCore
import ImageIO
import Vision

/**
 * On-device text recognition with Apple Vision (VNRecognizeTextRequest).
 * Runs fully offline, reads print and handwriting.
 *
 * Frames are normalised to 0...1 with a top-left origin so both platforms
 * return the same coordinate space.
 */
public class TextRecognitionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextRecognition")

    AsyncFunction("recognizeAsync") { (uri: String) throws -> [String: Any] in
      guard let url = Self.fileURL(from: uri),
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
      else {
        throw ImageLoadException(uri)
      }

      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any]
      let rawOrientation = properties?[kCGImagePropertyOrientation] as? UInt32 ?? 1
      let orientation = CGImagePropertyOrientation(rawValue: rawOrientation) ?? .up

      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.usesLanguageCorrection = true
      request.recognitionLanguages = ["en-US"]

      let handler = VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:])
      try handler.perform([request])

      let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
        let candidates = observation.topCandidates(3)
        guard let best = candidates.first else { return nil }
        // Vision boxes are bottom-left origin; flip to top-left.
        let box = observation.boundingBox
        return [
          "text": best.string,
          "confidence": Double(best.confidence),
          "alternatives": candidates.dropFirst().map { $0.string },
          "frame": [
            "x": Double(box.minX),
            "y": Double(1 - box.maxY),
            "width": Double(box.width),
            "height": Double(box.height),
          ],
        ]
      }

      let rotated = [.left, .leftMirrored, .right, .rightMirrored].contains(orientation)
      return [
        "width": rotated ? image.height : image.width,
        "height": rotated ? image.width : image.height,
        "lines": lines,
      ]
    }
  }

  private static func fileURL(from uri: String) -> URL? {
    if let url = URL(string: uri), url.scheme != nil {
      return url.isFileURL ? url : nil
    }
    return URL(fileURLWithPath: uri)
  }
}

internal final class ImageLoadException: GenericException<String> {
  override var reason: String {
    "Could not read the image at '\(param)'"
  }
}

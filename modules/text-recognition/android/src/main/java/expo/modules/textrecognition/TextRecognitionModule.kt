package expo.modules.textrecognition

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * On-device text recognition with ML Kit Text Recognition v2. The Latin model
 * is bundled in the APK (com.google.mlkit:text-recognition), so it works
 * offline from first launch.
 *
 * Frames are normalised to 0..1 with a top-left origin, matching iOS.
 */
class TextRecognitionModule : Module() {
  private val recognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  override fun definition() = ModuleDefinition {
    Name("TextRecognition")

    AsyncFunction("recognizeAsync") { uri: String, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val parsed = Uri.parse(uri).let { if (it.scheme == null) Uri.fromFile(File(uri)) else it }

      val image = try {
        // Applies EXIF rotation, so width/height are the upright size.
        InputImage.fromFilePath(context, parsed)
      } catch (e: Exception) {
        promise.reject("ERR_IMAGE_LOAD", "Could not read the image at '$uri'", e)
        return@AsyncFunction
      }

      val rotated = image.rotationDegrees == 90 || image.rotationDegrees == 270
      val width = (if (rotated) image.height else image.width).toDouble()
      val height = (if (rotated) image.width else image.height).toDouble()

      recognizer.process(image)
        .addOnSuccessListener { text ->
          val lines = text.textBlocks.flatMap { block ->
            block.lines.mapNotNull { line ->
              val box = line.boundingBox ?: return@mapNotNull null
              mapOf(
                "text" to line.text,
                "confidence" to line.confidence.toDouble(),
                "alternatives" to emptyList<String>(),
                "frame" to mapOf(
                  "x" to box.left / width,
                  "y" to box.top / height,
                  "width" to box.width() / width,
                  "height" to box.height() / height,
                ),
              )
            }
          }
          promise.resolve(mapOf("width" to width, "height" to height, "lines" to lines))
        }
        .addOnFailureListener { e ->
          promise.reject("ERR_RECOGNITION", e.message ?: "Text recognition failed", e)
        }
    }
  }
}

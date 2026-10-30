import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { RecognizedText } from './TextRecognition.types';

declare class TextRecognitionModule extends NativeModule {
  recognizeAsync(uri: string): Promise<RecognizedText>;
}

/** `null` on web and in native builds made before the module was added. */
export default requireOptionalNativeModule<TextRecognitionModule>('TextRecognition');

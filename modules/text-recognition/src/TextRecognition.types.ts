/** Normalised 0..1 rectangle, top-left origin. */
export type TextFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** One line of recognised text. */
export type TextLine = {
  text: string;
  /** 0..1; ML Kit and Vision scale differently, so compare only within a platform. */
  confidence: number;
  /** Next-best readings (iOS only; empty on Android). */
  alternatives: string[];
  frame: TextFrame;
};

export type RecognizedText = {
  /** Upright image size in pixels. */
  width: number;
  height: number;
  lines: TextLine[];
};

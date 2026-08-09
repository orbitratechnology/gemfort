import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { db } from "../admin";
import { HOT_CALLABLE } from "../config";

const PROJECT_ID = "gemfort";
const PROJECT_NUMBER = "478360291449";
const JWKS_URI = "https://fpnv.googleapis.com/v1beta/jwks";
const ISSUER = `https://fpnv.googleapis.com/projects/${PROJECT_NUMBER}`;
/** Token aud lists BOTH the project number and project id. */
const AUDIENCES = [
  `https://fpnv.googleapis.com/projects/${PROJECT_NUMBER}`,
  `https://fpnv.googleapis.com/projects/${PROJECT_ID}`,
];
const PHONE_RE = /^\+\d{10,15}$/;

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

/**
 * Links the caller's Firebase Auth account to the phone number Google verified
 * on-device via Phone Number Verification (carrier-level, no SMS). The client
 * sends the JWT from `getVerifiedPhoneNumber()`; we verify signature and claims
 * against FPNV's JWKS, then update Auth + Firestore so the number is trusted
 * without an OTP.
 */
export const linkVerifiedPhone = onCall(HOT_CALLABLE, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError(
      "unauthenticated",
      "Sign in to verify your phone number.",
    );
  }
  const uid = request.auth.uid;

  const token = request.data?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "A verification token is required.",
    );
  }

  let phoneNumber: string;
  try {
    const { payload, protectedHeader } = await jwtVerify(token, jwks, {
      algorithms: ["ES256"],
      issuer: ISSUER,
      audience: AUDIENCES,
    });
    if (protectedHeader.typ !== "JWT") {
      throw new Error("Unexpected token type");
    }
    phoneNumber = typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    throw new HttpsError(
      "unauthenticated",
      "The verification token could not be validated.",
    );
  }

  if (!PHONE_RE.test(phoneNumber)) {
    throw new HttpsError(
      "invalid-argument",
      "The verification did not return a valid phone number.",
    );
  }

  try {
    await getAuth().updateUser(uid, { phoneNumber });
  } catch (error) {
    const code = errorCode(error);
    if (
      code.includes("phone-number-already-exists") ||
      code.includes("phone-number-in-use")
    ) {
      throw new HttpsError(
        "already-exists",
        "This mobile number is already linked to another account.",
      );
    }
    logger.error("linkVerifiedPhone updateUser failed", { uid, code });
    throw new HttpsError(
      "internal",
      "Could not link your phone number. Please try again.",
    );
  }

  try {
    await db.collection("users").doc(uid).update({
      phone: phoneNumber,
      phoneVerified: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("linkVerifiedPhone profile update failed", {
      uid,
      code: errorCode(error),
    });
    throw new HttpsError(
      "internal",
      "Could not update your profile. Please try again.",
    );
  }

  logger.info("linkVerifiedPhone succeeded", { uid });
  return { phoneNumber };
});

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
}

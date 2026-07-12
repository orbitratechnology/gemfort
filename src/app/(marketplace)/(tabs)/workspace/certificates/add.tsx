import { Redirect } from 'expo-router';

/** Hub "Add certificate" deep link — form lives on the certificates index. */
export default function AddCertificateRedirect() {
  return <Redirect href="/(marketplace)/(tabs)/workspace/certificates?add=1" />;
}

import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { Fetcher } from "./types";

const IAP_PUBKEY_URL = "https://www.gstatic.com/iap/verify/public_key";
const IAP_ISS = "https://cloud.google.com/iap";

export let cachedKeys: { [key: string]: string } = {};

export async function getPubKey(
  keyID: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  let key = cachedKeys[keyID];

  if (!key) {
    const response = await fetcher(IAP_PUBKEY_URL);
    cachedKeys = await response.json();

    key = cachedKeys[keyID];
    if (!key) {
      throw new Error(`Public key not found`);
    }
  }

  return key;
}

export async function validateIAPToken(
    iapToken: string,
    expectedAudiences: string | string[],
    fetcher: Fetcher = fetch,
): Promise<string | { [key: string]: any }> {
  const decoded = jwt.decode(iapToken, { complete: true });

  if (
      !decoded ||
      !decoded.payload ||
      typeof decoded.payload === "string" ||
      !decoded.header
  ) {
    throw Error(`Failed to decode IAP JWT [${iapToken}]`);
  }

  if (decoded.payload.iss !== IAP_ISS) {
    throw Error(`Invalid IAP issuer [${decoded.payload.iss}]`);
  }

  const expectedAudienceArray = Array.isArray(expectedAudiences)
      ? expectedAudiences
      : [expectedAudiences];
  const aud = decoded.payload.aud;

  if (
      (typeof aud === "string" && !expectedAudienceArray.includes(aud)) ||
      (Array.isArray(aud) && !aud.some(a => expectedAudienceArray.includes(a))) ||
      aud === undefined
  ) {
    throw Error(`Invalid audience [${aud}]`);
  }


  const keyID = decoded.header.kid;

  if (!keyID) {
    throw Error('Missing "kid" attribute from IAP JWT');
  }


  try {
    const pubKey = await getPubKey(keyID, fetcher);
    return jwt.verify(iapToken, pubKey, { algorithms: ["ES256"] });
  } catch (err) {
    throw err;
  }
}
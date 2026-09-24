/** Wisconsin's 72 counties keyed by 3-digit county FIPS code (state FIPS 55). */
export const WI_COUNTIES: Record<string, string> = {
  "001": "Adams", "003": "Ashland", "005": "Barron", "007": "Bayfield", "009": "Brown",
  "011": "Buffalo", "013": "Burnett", "015": "Calumet", "017": "Chippewa", "019": "Clark",
  "021": "Columbia", "023": "Crawford", "025": "Dane", "027": "Dodge", "029": "Door",
  "031": "Douglas", "033": "Dunn", "035": "Eau Claire", "037": "Florence", "039": "Fond du Lac",
  "041": "Forest", "043": "Grant", "045": "Green", "047": "Green Lake", "049": "Iowa",
  "051": "Iron", "053": "Jackson", "055": "Jefferson", "057": "Juneau", "059": "Kenosha",
  "061": "Kewaunee", "063": "La Crosse", "065": "Lafayette", "067": "Langlade", "069": "Lincoln",
  "071": "Manitowoc", "073": "Marathon", "075": "Marinette", "077": "Marquette", "078": "Menominee",
  "079": "Milwaukee", "081": "Monroe", "083": "Oconto", "085": "Oneida", "087": "Outagamie",
  "089": "Ozaukee", "091": "Pepin", "093": "Pierce", "095": "Polk", "097": "Portage",
  "099": "Price", "101": "Racine", "103": "Richland", "105": "Rock", "107": "Rusk",
  "109": "St. Croix", "111": "Sauk", "113": "Sawyer", "115": "Shawano", "117": "Sheboygan",
  "119": "Taylor", "121": "Trempealeau", "123": "Vernon", "125": "Vilas", "127": "Walworth",
  "129": "Washburn", "131": "Washington", "133": "Waukesha", "135": "Waupaca", "137": "Waushara",
  "139": "Winnebago", "141": "Wood",
};

export const WI_COUNTY_NAMES = Object.values(WI_COUNTIES).sort();

/** Normalise "ST CROIX", "St. Croix County", "fond du lac" etc. to the canonical name. */
export function canonicalCounty(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw
    .toLowerCase()
    .replace(/\bcounty\b/g, "")
    .replace(/[^a-z]/g, "");
  for (const name of Object.values(WI_COUNTIES)) {
    if (name.toLowerCase().replace(/[^a-z]/g, "") === key) return name;
  }
  return null;
}

/** Western WI counties where industrial (frac) sand mining concentrates. */
export const INDUSTRIAL_SAND_COUNTIES = new Set([
  "Barron", "Buffalo", "Chippewa", "Clark", "Dunn", "Eau Claire", "Jackson", "Monroe",
  "Pepin", "Pierce", "Polk", "St. Croix", "Trempealeau", "Wood", "Juneau", "Adams",
]);

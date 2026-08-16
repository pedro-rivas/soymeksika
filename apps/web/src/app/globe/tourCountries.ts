export interface TourCountry {
  /** must match the GeoJSON feature ADMIN (or NAME) property */
  match: string;
  displayName: string;
  flag: string;
  color: string;
}

export const TOUR_COUNTRIES: TourCountry[] = [
  { match: "Mexico", displayName: "Mexico", flag: "🇲🇽", color: "#2ecc71" },
  {
    match: "United States of America",
    displayName: "USA",
    flag: "🇺🇸",
    color: "#9b59b6",
  },
  { match: "Colombia", displayName: "Colombia", flag: "🇨🇴", color: "#e74c3c" },
];

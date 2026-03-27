export type Restaurant = {
  id: string;
  name: string;
  genre_code: string;
  genre_name: string;
  address: string;
  lat: number;
  lng: number;
  budget_name: string;
  budget_average: string;
  photo_l: string;
  photo_s: string;
  open: string;
  close: string;
  catch_text: string;
  url: string;
  private_room: boolean;
  free_drink: boolean;
  free_food: boolean;
};

export type ScoredRestaurant = Restaurant & {
  match_score: number;
  rating_score: number;
  distance_km?: number;
};

export type HotPepperSearchParams = {
  keyword?: string;
  large_area?: string;
  middle_area?: string;
  small_area?: string;
  lat?: number;
  lng?: number;
  range?: 1 | 2 | 3 | 4 | 5; // 1=300m, 2=500m, 3=1km, 4=2km, 5=3km
  genre?: string; // comma-separated genre codes
  budget?: string;
  count?: number;
  start?: number;
  order?: 1 | 2 | 3 | 4; // 1=name, 2=genre, 3=area, 4=recommendation
  private_room?: 0 | 1;
  free_drink?: 0 | 1;
  free_food?: 0 | 1;
  lunch?: 0 | 1;
  midnight?: 0 | 1;
};

export type HotPepperShop = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  genre: {
    code: string;
    name: string;
    catch: string;
  };
  budget: {
    code: string;
    name: string;
    average: string;
  };
  catch: string;
  access: string;
  urls: {
    pc: string;
  };
  photo: {
    pc: {
      l: string;
      m: string;
      s: string;
    };
    mobile: {
      l: string;
      s: string;
    };
  };
  open: string;
  close: string;
  private_room: string;
  free_drink: string;
  free_food: string;
  lunch: string;
};

export type HotPepperResponse = {
  results: {
    api_version: string;
    results_available: number;
    results_returned: string;
    results_start: number;
    shop: HotPepperShop[];
    error?: { code: number; message: string }[];
  };
};

export type HotPepperGenre = {
  code: string;
  name: string;
};

export type HotPepperArea = {
  code: string;
  name: string;
};

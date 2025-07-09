import {HassEntity} from "home-assistant-js-websocket";

export enum WeatherEntityFeature {
    FORECAST_DAILY = 1,
    FORECAST_HOURLY = 2,
    FORECAST_TWICE_DAILY = 4,
}

export interface ForecastConfig {
    precipitation_type: string,
    show_probability: boolean;
    chart_height: number,
    labels_font_size: number,
    precip_bar_size: number,
    style: 'style1' | 'style2',
    show_wind_forecast: boolean;
    condition_icons: boolean;
    round_temp: boolean;
    type: 'daily' | 'hourly',
    number_of_forecasts: number,
    disable_animation: boolean;
    temperature1_color: string,
    temperature2_color: string,
    precipitation_color: string,
    use_12hour_format: boolean,
    chart_text_color: string;
    chart_datetime_color?: string;
}

export interface UnitsConfig {
    pressure?: string,
    speed?: string,
    visibility?: string,
    temperature?: string,
}

export interface WeatherChartCardConfig extends Record<string, any> {
    title?: string;
    entity: string;
    forecast: ForecastConfig;
    units: UnitsConfig;
    show_main: boolean;
    show_temperature: boolean;
    show_current_condition: boolean;
    show_attributes: boolean;
    show_time: boolean;
    show_time_seconds: boolean;
    show_day: boolean;
    show_date: boolean;
    show_humidity: boolean;
    show_pressure: boolean;
    show_wind_direction: boolean;
    show_wind_speed: boolean;
    show_sun: boolean;
    show_feels_like: boolean;
    show_dew_point: boolean;
    show_wind_gust_speed: boolean;
    show_visibility: boolean;
    show_last_changed: boolean;
    use_12hour_format: boolean;
    current_temp_size: number;
    time_size: number;
    day_date_size: number;
    show_description: boolean;
    icons_size: number;
    animated_icons: boolean;
    icon_style: 'style1' | 'style2';
    autoscroll: boolean;
    locale?: string;
    description?: string;
    feather_icons?: string;
    feels_like?: string;
    temp?: string;
    humid?: string;
    press?: string;
    uv?: string;
    windspeed?: string;
    dew_point?: string;
    wind_gust_speed?: string;
    visibility?: string;
    winddir?: string;
    icons?: string;
}

export interface ForecastItem {
    datetime: string;
    temperature: number;
    templow?: number;
    precipitation_probability?: number;
    precipitation?: number;
    condition?: string;
    wind_bearing?: number | string;
    wind_speed?: number;
}

export interface ForecastEvent {
    forecast: ForecastItem[];
}

export type SubscriptionUnsubscribe = () => Promise<void>;

export interface WeatherEntity extends HassEntity {
  attributes: {
    temperature: number;
    temperature_unit: string;
    humidity: number;
    pressure: number;
    pressure_unit: string;
    wind_speed: number;
    wind_speed_unit: string;
    wind_bearing: number | string;
    visibility: number;
    visibility_unit: string;
    precipitation_unit?: string;
    forecast?: ForecastItem[];
    uv_index?: number;
    dew_point?: number;
    wind_gust_speed?: number;
    supported_features?: WeatherEntityFeature;
    [key: string]: any;
  };
}

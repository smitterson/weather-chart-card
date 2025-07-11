// noinspection CssUnresolvedCustomProperty

import locale from './locale';
import {cardinalDirectionsIcon, weatherIcons, weatherIconsDay, weatherIconsNight,} from './const';
import {html, LitElement, PropertyValues} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import './weather-chart-card-editor.js';
import {Chart, ChartDataset, Color, registerables} from 'chart.js';
import ChartDataLabels, {Context} from 'chartjs-plugin-datalabels';
import {HomeAssistant} from "custom-card-helpers";
import {
    ForecastEvent,
    ForecastItem,
    SubscriptionUnsubscribe,
    WeatherChartCardConfig,
    WeatherEntity,
    WeatherEntityFeature
} from "./types";
import {HassEntity} from "home-assistant-js-websocket";

Chart.register(...registerables, ChartDataLabels);

const PKG_VERSION = 'PKG_VERSION_VALUE';

console.info(`🌦 Weather-Chart-Card ${PKG_VERSION}`);

@customElement('weather-chart-card')
export class WeatherChartCard extends LitElement {
    @property({ attribute: false }) public _hass!: HomeAssistant;

    private baseIconPath = '';
    private forecastSubscriber?: Promise<SubscriptionUnsubscribe>;

    @state() private config?: WeatherChartCardConfig;
    @state() private language?: string;
    @state() private sun: HassEntity | null = null;
    @state() private weather: WeatherEntity | null = null;
    @state() private forecasts: ForecastItem[] = [];

    @state() private forecastChart: Chart | null = null;
    @state() private forecastItems = 0;
    @state() private unitSpeed?: string;
    @state() private unitPressure?: string;
    @state() private unitVisibility?: string;
    @state() private temperature = 0;
    @state() private humidity?: number;
    @state() private pressure?: number;
    @state() private windSpeed?: number;
    @state() private uv_index?: number
    @state() private feels_like?: number;
    @state() private dew_point?: number;
    @state() private wind_gust_speed?: number;
    @state() private visibility?: number;
    @state() private description = '';
    @state() private windDirection?: string | number;

    private resizeObserver: ResizeObserver | null;
    private resizeInitialized: boolean;
    private autoscrollTimeout:  NodeJS.Timeout | null = null;

    private units = this.ll("units") as Record<string, string>;

    public static async getConfigElement() {
        await import('./weather-chart-card-editor');
        return document.createElement("weather-chart-card-editor");
    }

    static getStubConfig(_: HomeAssistant, unusedEntities: string[], allEntities: string[]) : WeatherChartCardConfig {
        let entity = unusedEntities.find((eid) => eid.split(".")[0] === "weather");
        if (!entity) {
            entity = allEntities.find((eid) => eid.split(".")[0] === "weather");
        }
        return {
            entity: entity ?? '',
            show_main: true,
            show_temperature: true,
            show_current_condition: true,
            show_attributes: true,
            show_time: false,
            show_time_seconds: false,
            show_day: false,
            show_date: false,
            show_humidity: true,
            show_pressure: true,
            show_wind_direction: true,
            show_wind_speed: true,
            show_sun: true,
            show_feels_like: false,
            show_dew_point: false,
            show_wind_gust_speed: false,
            show_visibility: false,
            show_last_changed: false,
            use_12hour_format: false,
            current_temp_size: 28,
            time_size: 26,
            day_date_size: 15,
            show_description: false,
            icons_size: 25,
            animated_icons: false,
            icon_style: 'style1',
            autoscroll: false,
            forecast: {
                precipitation_type: 'rainfall',
                show_probability: false,
                labels_font_size: 11,
                precip_bar_size: 100,
                style: 'style1',
                show_wind_forecast: true,
                condition_icons: true,
                round_temp: false,
                type: 'daily',
                number_of_forecasts: 0,
                disable_animation: false,
                chart_height: 180,
                temperature1_color: 'rgba(255, 152, 0, 1.0)',
                temperature2_color: 'rgba(68, 115, 158, 1.0)',
                precipitation_color: 'rgba(132, 209, 253, 1.0)',
                use_12hour_format: false,
                chart_text_color: "auto"
            },
            units: { }
        };
    }

    public setConfig(config?: WeatherChartCardConfig) {
        if (!config) {
            throw new Error('Invalid configuration.');
        }
        if (!config.entity) {
            throw new Error('You need to define entities.');
        }

        const cardConfig : WeatherChartCardConfig = {
            ...config,
            // TODO: sort out why these aren't included in the config?
            current_temp_size: 28,
            time_size: 26,
            day_date_size: 15,
            show_description: false,
        };

        cardConfig.forecast = {
            ...cardConfig.forecast,
            // TODO: sort out why these aren't included in the config?
            chart_height: 180,
            temperature1_color: 'rgba(255, 152, 0, 1.0)',
            temperature2_color: 'rgba(68, 115, 158, 1.0)',
            precipitation_color: 'rgba(132, 209, 253, 1.0)',
        };

        this.baseIconPath = cardConfig.icon_style === 'style2' ?
            'https://cdn.jsdelivr.net/gh/mlamberts78/weather-chart-card/dist/icons2/':
            'https://cdn.jsdelivr.net/gh/mlamberts78/weather-chart-card/dist/icons/' ;

        this.config = cardConfig;

        if (!config.entity) {
            throw new Error('Please, define entity in the card config');
        }
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;
        this.language = this.config?.locale ?? hass.selectedLanguage ?? hass.language;
        this.sun = 'sun.sun' in hass.states ? hass.states['sun.sun'] : null;
        if (this.config?.entity) {
            this.weather = this.config.entity in hass.states
                ? hass.states[this.config.entity] as WeatherEntity
                : null;
        }
        this.unitSpeed = this.config?.units.speed ?? this.weather?.attributes.wind_speed_unit;
        this.unitPressure = this.config?.units.pressure ?? this.weather?.attributes.pressure_unit;
        this.unitVisibility = this.config?.units.visibility ?? this.weather?.attributes.visibility_unit;

        if (this.weather) {
            this.temperature = this.config?.temp ? parseFloat(hass.states[this.config.temp].state) : this.weather.attributes.temperature;
            this.humidity = this.config?.humid ? parseFloat(hass.states[this.config.humid].state) : this.weather.attributes.humidity;
            this.pressure = this.config?.press ? parseFloat(hass.states[this.config.press].state) : this.weather.attributes.pressure;
            this.uv_index = this.config?.uv ? parseFloat(hass.states[this.config.uv].state) : this.weather.attributes.uv_index;
            this.windSpeed = this.config?.windspeed ? parseFloat(hass.states[this.config.windspeed].state) : this.weather.attributes.wind_speed;
            this.dew_point = this.config?.dew_point ? parseFloat(hass.states[this.config.dew_point].state) : this.weather.attributes.dew_point;
            this.wind_gust_speed = this.config?.wind_gust_speed ? parseFloat(hass.states[this.config.wind_gust_speed].state) : this.weather.attributes.wind_gust_speed;
            this.visibility = this.config?.visibility ? parseFloat(hass.states[this.config.visibility].state) : this.weather.attributes.visibility;

            if (this.config?.winddir && hass.states[this.config.winddir] && hass.states[this.config.winddir].state !== undefined) {
                this.windDirection = parseFloat(hass.states[this.config.winddir].state);
            } else {
                this.windDirection = this.weather.attributes.wind_bearing;
            }

            this.feels_like = this.config?.feels_like && hass.states[this.config.feels_like] ? hass.states[this.config.feels_like].state : this.weather.attributes.apparent_temperature;
            this.description = this.config?.description && hass.states[this.config.description] ? hass.states[this.config.description].state : this.weather.attributes.description;
        }

        if (this.weather && !this.forecastSubscriber) {
            this.subscribeForecastEvents();
        }
    }

    subscribeForecastEvents() {
        const forecastType = this.config?.forecast.type;
        const isHourly = forecastType === 'hourly';

        const feature = isHourly ? WeatherEntityFeature.FORECAST_HOURLY : WeatherEntityFeature.FORECAST_DAILY;
        if (!this.supportsFeature(feature)) {
            console.error(`Weather entity "${this.config?.entity}" does not support ${isHourly ? 'hourly' : 'daily'} forecasts.`);
            return;
        }

        const callback = (event: ForecastEvent) => {
            this.forecasts = event.forecast;
            if (this.config?.autoscroll) {
                this.removeOutdatedForecasts();
            }
            this.requestUpdate();
            this.drawChart();
        };

        this.forecastSubscriber = this._hass.connection.subscribeMessage(callback, {
            type: "weather/subscribe_forecast",
            forecast_type: isHourly ? 'hourly' : 'daily',
            entity_id: this.config?.entity,
        });
    }

    supportsFeature(feature: WeatherEntityFeature) {
        if (!this.weather?.attributes.supported_features) return false;
        return (this.weather?.attributes.supported_features & feature) !== 0;
    }

    constructor() {
        super();
        this.resizeObserver = null;
        this.resizeInitialized = false;
    }

    connectedCallback() {
        super.connectedCallback();
        if (!this.resizeInitialized) {
            this.delayedAttachResizeObserver();
        }
    }

    delayedAttachResizeObserver() {
        setTimeout(() => {
            this.attachResizeObserver();
            this.resizeInitialized = true;
        }, 0);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.detachResizeObserver();
        if (this.forecastSubscriber) {
            this.forecastSubscriber.then((unsub) => unsub());
        }
    }

    attachResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            this.measureCard();
        });
        const card = this.shadowRoot?.querySelector('ha-card');
        if (card) {
            this.resizeObserver.observe(card);
        }
    }

    detachResizeObserver() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
    }

    measureCard() {
        const card = this.shadowRoot?.querySelector('ha-card');
        const fontSize = this.config?.forecast.labels_font_size ?? 11;
        const numberOfForecasts = this.config?.forecast.number_of_forecasts ?? 0;

        if (!card) {
            return;
        }

        const htmlElement = card as HTMLElement;
        this.forecastItems = numberOfForecasts > 0 ? numberOfForecasts : Math.round(htmlElement.offsetWidth / (fontSize * 6));
        this.drawChart();
    }

    ll(str: string) {
        const selectedLocale = (this.config?.locale ?? this.language) ?? 'en';

        if (locale[selectedLocale] === undefined) {
            return locale.en?.[str];
        }

        return locale[selectedLocale][str];
    }

    getCardSize() {
        return 4;
    }

    getUnit(unit: string) {
        // @ts-expect-error allow indexing by string
        return this._hass.config.unit_system[unit] || '';
    }

    getWeatherIcon(condition: string, sun: string) {
        if (this.config?.animated_icons) {
            const iconName = sun === 'below_horizon' ? weatherIconsNight[condition] : weatherIconsDay[condition];
            return `${this.baseIconPath}${iconName}.svg`;
        } else if (this.config?.icons) {
            const iconName = sun === 'below_horizon' ? weatherIconsNight[condition] : weatherIconsDay[condition];
            return `${this.config?.icons}${iconName}.svg`;
        }
        return weatherIcons[condition];
    }

    getWindDirIcon(deg: string | number) {
        if (typeof deg === 'number') {
            return cardinalDirectionsIcon[Math.trunc((deg + 22.5) / 45.0)];
        } else {
            let i: number;
            switch (deg) {
                case "N":
                    i = 0;
                    break;
                case "NNE":
                case "NE":
                    i = 1;
                    break;
                case "ENE":
                case "E":
                    i = 2;
                    break;
                case "ESE":
                case "SE":
                    i = 3;
                    break;
                case "SSE":
                case "S":
                    i = 4;
                    break;
                case "SSW":
                case "SW":
                    i = 5;
                    break;
                case "WSW":
                case "W":
                    i = 6;
                    break;
                case "NW":
                case "NNW":
                    i = 7;
                    break;
                case "WNW":
                    i = 8;
                    break;
                default:
                    i = 9;
                    break;
            }
            return cardinalDirectionsIcon[i];
        }
    }

    getWindDir(dir: string | number) {
        if (typeof dir === 'number') {
            const cardinalDirections = this.ll('cardinalDirections') as Record<string, string>;
            const windDir = [
                cardinalDirections.N,
                cardinalDirections.NNE,
                cardinalDirections.NE,
                cardinalDirections.ENE,
                cardinalDirections.E,
                cardinalDirections.ESE,
                cardinalDirections.SE,
                cardinalDirections.SSE,
                cardinalDirections.S,
                cardinalDirections.SSW,
                cardinalDirections.SW,
                cardinalDirections.WSW,
                cardinalDirections.W,
                cardinalDirections.WNW,
                cardinalDirections.NW,
                cardinalDirections.NNW,
                cardinalDirections.N
            ];
            return windDir[Math.trunc((dir + 11.25) / 22.5)];
        } else {
            return dir;
        }
    }

    calculateBeaufortScale(windSpeed: number) {
        const unitConversion: Record<string, number> = {
            'km/h': 1,
            'm/s': 3.6,
            'mph': 1.60934,
        };

        if (!this.weather?.attributes.wind_speed_unit) {
            throw new Error('wind_speed_unit not available in weather attributes.');
        }

        const wind_speed_unit = this.weather.attributes.wind_speed_unit;
        const conversionFactor = unitConversion[wind_speed_unit];

        if (!conversionFactor) {
            throw new Error(`Unknown wind_speed_unit: ${wind_speed_unit}`);
        }

        const windSpeedInKmPerHour = windSpeed * conversionFactor;

        if (windSpeedInKmPerHour < 1) return 0;
        else if (windSpeedInKmPerHour < 6) return 1;
        else if (windSpeedInKmPerHour < 12) return 2;
        else if (windSpeedInKmPerHour < 20) return 3;
        else if (windSpeedInKmPerHour < 29) return 4;
        else if (windSpeedInKmPerHour < 39) return 5;
        else if (windSpeedInKmPerHour < 50) return 6;
        else if (windSpeedInKmPerHour < 62) return 7;
        else if (windSpeedInKmPerHour < 75) return 8;
        else if (windSpeedInKmPerHour < 89) return 9;
        else if (windSpeedInKmPerHour < 103) return 10;
        else if (windSpeedInKmPerHour < 118) return 11;
        else return 12;
    }

    async firstUpdated(changedProperties: PropertyValues) {
        super.firstUpdated(changedProperties);
        this.measureCard();
        await new Promise(resolve => setTimeout(resolve, 0));
        this.drawChart();

        if (this.config?.autoscroll) {
            this.autoscroll();
        }
    }


    async updated(changedProperties: PropertyValues) {
        await this.updateComplete;

        if (changedProperties.has('config')) {
            const oldConfig = changedProperties.get('config');

            const entityChanged = oldConfig && this.config?.entity !== oldConfig.entity;
            const forecastTypeChanged = oldConfig && this.config?.forecast.type !== oldConfig.forecast.type;
            const autoscrollChanged = oldConfig && this.config?.autoscroll !== oldConfig.autoscroll;

            if (entityChanged || forecastTypeChanged) {
                if (this.forecastSubscriber) {
                    this.forecastSubscriber.then((unsub) => unsub());
                }

                this.subscribeForecastEvents();
            }

            if (this.forecasts?.length) {
                this.drawChart();
            }

            if (autoscrollChanged) {
                if (!this.config?.autoscroll) {
                    this.autoscroll();
                } else {
                    this.cancelAutoscroll();
                }
            }
        }

        if (changedProperties.has('weather')) {
            this.updateChart();
        }
    }

    autoscroll() {
        if (this.autoscrollTimeout) {
            // Autoscroll already set, nothing to do
            return;
        }

        const updateChartOncePerHour = () => {
            const now = new Date();
            const nextHour = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                now.getHours()+1,
            );
            this.autoscrollTimeout = setTimeout(() => {
                this.autoscrollTimeout = null;
                this.removeOutdatedForecasts();
                this.updateChart();
                updateChartOncePerHour();
            }, nextHour.getTime() - now.getTime());
        };

        updateChartOncePerHour();
    }

    cancelAutoscroll() {
        if (this.autoscrollTimeout) {
            clearTimeout(this.autoscrollTimeout);
        }
    }

    removeOutdatedForecasts({ config, forecasts } = this) {
        if (!config) return;

        const now = Date.now();
        const cutoff = (config.forecast.type === 'hourly' ? 1 : 24) * 60 * 60 * 1000;
        this.forecasts = forecasts.filter((f) => now - new Date(f.datetime).getTime() <= cutoff);
    }

    drawChart({ config, language } = this) {
        if (!this.forecasts.length) {
            return;
        }

        const chartCanvas = this.renderRoot?.querySelector('#forecastChart');
        if (!chartCanvas) {
            console.error('Canvas element not found:', this.renderRoot);
            return;
        }

        if (this.forecastChart) {
            this.forecastChart.destroy();
        }
        const tempUnit = this._hass.config.unit_system.temperature;
        const lengthUnit = this._hass.config.unit_system.length;
        let precipUnit;
        if (config?.forecast.precipitation_type === 'probability') {
            precipUnit = '%';
        } else {
            precipUnit = lengthUnit === 'km' ? this.units.mm : this.units.in;
        }
        const data = this.computeForecastData();

        const style = getComputedStyle(document.body);
        const backgroundColor = style.getPropertyValue('--card-background-color');
        const textColor = style.getPropertyValue('--primary-text-color');
        const dividerColor = style.getPropertyValue('--divider-color');
        const canvas = this.renderRoot.querySelector('#forecastChart');
        if (!canvas) {
            requestAnimationFrame(() => this.drawChart());
            return;
        }

        const canvasElement = canvas as HTMLCanvasElement;

        let precipMax;

        if (config?.forecast.precipitation_type === 'probability') {
            precipMax = 100;
        } else {
            if (config?.forecast.type === 'hourly') {
                precipMax = lengthUnit === 'km' ? 4 : 1;
            } else {
                precipMax = lengthUnit === 'km' ? 20 : 1;
            }
        }

        Chart.defaults.color = textColor;
        Chart.defaults.scale.grid.color = dividerColor;
        Chart.defaults.elements.line.fill = false;
        Chart.defaults.elements.line.tension = 0.3;
        Chart.defaults.elements.line.borderWidth = 1.5;
        Chart.defaults.elements.point.radius = 2;
        Chart.defaults.elements.point.hitRadius = 10;

        const datasets : ChartDataset<'line' | 'bar', (number | null)[]>[] = [
            {
                label: this.ll('tempHi') as string,
                type: 'line',
                data: data.tempHigh,
                yAxisID: 'TempAxis',
                borderColor: config?.forecast.temperature1_color,
                backgroundColor: config?.forecast.temperature1_color,
            },
            {
                label: this.ll('tempLo') as string,
                type: 'line',
                data: data.tempLow,
                yAxisID: 'TempAxis',
                borderColor: config?.forecast.temperature2_color,
                backgroundColor: config?.forecast.temperature2_color,
            },
            {
                label: this.ll('precip') as string,
                type: 'bar',
                data: data.precip,
                yAxisID: 'PrecipAxis',
                borderColor: config?.forecast.precipitation_color,
                backgroundColor: config?.forecast.precipitation_color,
                barPercentage: (config?.forecast.precip_bar_size ?? 0) / 100,
                categoryPercentage: 1.0,
                datalabels: {
                    display: function (context: Context) {
                        const rainfall = context.dataset.data[context.dataIndex] as number;
                        return rainfall > 0;
                    },
                    formatter: function (_value: any, context: Context) {
                        const precipitationType = config?.forecast.precipitation_type;

                        const rainfall = context.dataset.data[context.dataIndex] as number;
                        const probability = data.forecast[context.dataIndex].precipitation_probability;

                        let formattedValue;
                        if (precipitationType === 'rainfall') {
                            if (probability && config?.forecast.show_probability) {
                                formattedValue = `${rainfall > 9 ? Math.round(rainfall) : rainfall.toFixed(1)} ${precipUnit}\n${Math.round(probability)}%`;
                            } else {
                                formattedValue = `${rainfall > 9 ? Math.round(rainfall) : rainfall.toFixed(1)} ${precipUnit}`;
                            }
                        } else {
                            formattedValue = `${rainfall > 9 ? Math.round(rainfall) : rainfall.toFixed(1)} ${precipUnit}`;
                        }

                        formattedValue = formattedValue.replace('\n', '\n\n');

                        return formattedValue;
                    },
                    textAlign: 'center',
                    align: 'top',
                    anchor: 'start',
                    offset: -10,
                },
            },
        ];

        const chart_text_color = (config?.forecast.chart_text_color === 'auto') ? textColor : config?.forecast.chart_text_color;

        if (config?.forecast.style === 'style2') {
            datasets[0].datalabels = {
                display: function (_context) {
                    return true;
                },
                formatter: function (_value, context) {
                    return context.dataset.data[context.dataIndex] + '°';
                },
                align: 'top',
                anchor: 'center',
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                color: chart_text_color ?? config.forecast.temperature1_color,
                font: {
                    size: config.forecast.labels_font_size + 1,
                    lineHeight: 0.7,
                },
            };

            datasets[1].datalabels = {
                display: function (_context) {
                    return true;
                },
                formatter: function (_value, context) {
                    return context.dataset.data[context.dataIndex] + '°';
                },
                align: 'bottom',
                anchor: 'center',
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                color: chart_text_color ?? config.forecast.temperature2_color,
                font: {
                    size: config.forecast.labels_font_size + 1,
                    lineHeight: 0.7,
                },
            };
        }

        this.forecastChart = new Chart(canvasElement, {
            type: 'bar',
            data: {
                labels: data.dateTime,
                datasets: datasets,
            },
            options: {
                maintainAspectRatio: false,
                animation: config?.forecast.disable_animation ? { duration: 0 } : {},
                layout: {
                    padding: {
                        bottom: 10,
                    },
                },
                scales: {
                    x: {
                        position: 'top',
                        border: {
                            width: 0,
                        },
                        grid: {
                            drawTicks: false,
                            color: dividerColor,
                        },
                        ticks: {
                            maxRotation: 0,
                            color: config?.forecast.chart_datetime_color ?? textColor,
                            padding: config?.forecast.precipitation_type === 'rainfall' && config.forecast.show_probability && config.forecast.type !== 'hourly' ? 4 : 10,
                            callback: function (value, _index) {
                                const dateStr = typeof value === "string" ? value : this.getLabelForValue(value as number);
                                const dateObj = new Date(dateStr);

                                const timeFormatOptions: Intl.DateTimeFormatOptions = {
                                    hour12: config?.use_12hour_format,
                                    hour: 'numeric',
                                    ...(config?.use_12hour_format ? {} : { minute: 'numeric' }),
                                };

                                let time = dateObj.toLocaleTimeString(language, timeFormatOptions);

                                if (dateObj.getHours() === 0 && dateObj.getMinutes() === 0 && config?.forecast.type === 'hourly') {
                                    const dateFormatOptions: Intl.DateTimeFormatOptions = {
                                        day: 'numeric',
                                        month: 'short',
                                    };
                                    const date = dateObj.toLocaleDateString(language, dateFormatOptions);
                                    time = time.replace('a.m.', 'AM').replace('p.m.', 'PM');
                                    return [date, time];
                                }

                                if (config?.forecast.type !== 'hourly') {
                                    return dateObj.toLocaleString(language, {weekday: 'short'}).toUpperCase();
                                }

                                time = time.replace('a.m.', 'AM').replace('p.m.', 'PM');
                                return time;
                            },
                        },
                        reverse: document.dir === 'rtl',
                    },
                    TempAxis: {
                        position: 'left',
                        beginAtZero: false,
                        suggestedMin: Math.min(...data.tempHigh, ...data.tempLow) - 5,
                        suggestedMax: Math.max(...data.tempHigh, ...data.tempLow) + 3,
                        grid: {
                            display: false,
                            drawTicks: false,
                        },
                        ticks: {
                            display: false,
                        },
                    },
                    PrecipAxis: {
                        position: 'right',
                        suggestedMax: precipMax,
                        grid: {
                            display: false,
                            drawTicks: false,
                        },
                        ticks: {
                            display: false,
                        },
                    },
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    datalabels: {
                        backgroundColor: backgroundColor,
                        borderColor: context => context.dataset.borderColor as Color,
                        borderRadius: 0,
                        borderWidth: 1.5,
                        padding: config?.forecast.precipitation_type === 'rainfall' && config.forecast.show_probability && config.forecast.type !== 'hourly' ? 3 : 4,
                        color: chart_text_color ?? textColor,
                        font: {
                            size: config?.forecast.labels_font_size,
                            lineHeight: 0.7,
                        },
                        formatter: function (_value, context) {
                            return context.dataset.data[context.dataIndex] + '°';
                        },
                    },
                    tooltip: {
                        caretSize: 0,
                        caretPadding: 15,
                        callbacks: {
                            title: function (TooltipItem) {
                                const datetime = TooltipItem[0].label;
                                return new Date(datetime).toLocaleDateString(language, {
                                    month: 'short',
                                    day: 'numeric',
                                    weekday: 'short',
                                    hour: 'numeric',
                                    minute: 'numeric',
                                    hour12: config?.use_12hour_format,
                                });
                            },
                            label: function (context) {
                                const label = context.dataset.label;
                                const value = context.formattedValue;
                                const probability = data.forecast[context.dataIndex].precipitation_probability;
                                const unit = context.datasetIndex === 2 ? precipUnit : tempUnit;

                                if (config?.forecast.precipitation_type === 'rainfall' && context.datasetIndex === 2 && config.forecast.show_probability && probability) {
                                    return label + ': ' + value + ' ' + precipUnit + ' / ' + Math.round(probability) + '%';
                                } else {
                                    return label + ': ' + value + ' ' + unit;
                                }
                            },
                        },
                    },
                },
            },
        });
    }

    computeForecastData({ config, forecastItems } = this) {
        const forecast = this.forecasts ? this.forecasts.slice(0, forecastItems) : [];
        const roundTemp = config?.forecast.round_temp;
        const dateTime = [];
        const tempHigh = [];
        const tempLow = [];
        const precip = [];

        for (let i = 0; i < forecast.length; i++) {
            const d = forecast[i];
            dateTime.push(d.datetime);
            tempHigh.push(d.temperature);
            if (typeof d.templow !== 'undefined') {
                tempLow.push(d.templow);
            }

            if (roundTemp) {
                tempHigh[i] = Math.round(tempHigh[i]);
                if (typeof d.templow !== 'undefined') {
                    tempLow[i] = Math.round(tempLow[i]);
                }
            }
            if (config?.forecast.precipitation_type === 'probability') {
                precip.push(d.precipitation_probability ?? 0);
            } else {
                precip.push(d.precipitation ?? 0);
            }
        }

        return {
            forecast,
            dateTime,
            tempHigh,
            tempLow,
            precip,
        }
    }

    updateChart({ forecasts, forecastChart } = this) {
        if (!forecasts.length) {
            return;
        }

        const data = this.computeForecastData();

        if (forecastChart) {
            forecastChart.data.labels = data.dateTime;
            forecastChart.data.datasets[0].data = data.tempHigh;
            forecastChart.data.datasets[1].data = data.tempLow;
            forecastChart.data.datasets[2].data = data.precip;
            forecastChart.update();
        }
    }

    render({config, _hass, weather} = this) {
        if (!config || !_hass) {
            return html``;
        }
        if (!weather?.attributes) {
            return html`
                <style>
                    .card {
                        padding-top: ${config.title? '0px' : '16px'};
                        padding-right: 16px;
                        padding-bottom: 16px;
                        padding-left: 16px;
                    }
                </style>
                <ha-card header="${config.title}">
                    <div class="card">
                        Please, check your weather entity
                    </div>
                </ha-card>
            `;
        }
        return html`
            <style>
                ha-icon {
                    color: var(--paper-item-icon-color);
                }
                img {
                    width: ${config.icons_size}px;
                    height: ${config.icons_size}px;
                }
                .card {
                    padding-top: ${config.title ? '0px' : '16px'};
                    padding-right: 16px;
                    padding-bottom: ${config.show_last_changed ? '2px' : '16px'};
                    padding-left: 16px;
                }
                .main {
                    display: flex;
                    align-items: center;
                    font-size: ${config.current_temp_size}px;
                    margin-bottom: 10px;
                }
                .main ha-icon {
                    --mdc-icon-size: 50px;
                    margin-right: 14px;
                    margin-inline-start: initial;
                    margin-inline-end: 14px;
                }
                .main img {
                    width: ${config.icons_size * 2}px;
                    height: ${config.icons_size * 2}px;
                    margin-right: 14px;
                    margin-inline-start: initial;
                    margin-inline-end: 14px;
                }
                .main div {
                    line-height: 0.9;
                }
                .main span {
                    font-size: 18px;
                    color: var(--secondary-text-color);
                }
                .attributes {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 6px;
                    font-weight: 300;
                    direction: ltr;
                }
                .chart-container {
                    position: relative;
                    height: ${config.forecast.chart_height}px;
                    width: 100%;
                    direction: ltr;
                }
                .conditions {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    margin: 0px 5px 0px 5px;
                    cursor: pointer;
                }
                .forecast-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    margin: 1px;
                }
                .wind-details {
                    display: flex;
                    justify-content: space-around;
                    align-items: center;
                    font-weight: 300;
                }
                .wind-detail {
                    display: flex;
                    align-items: center;
                    margin: 1px;
                }
                .wind-detail ha-icon {
                    --mdc-icon-size: 15px;
                    margin-right: 1px;
                    margin-inline-start: initial;
                    margin-inline-end: 1px;
                }
                .wind-icon {
                    margin-right: 1px;
                    margin-inline-start: initial;
                    margin-inline-end: 1px;
                    position: relative;
                    bottom: 1px;
                }
                .wind-speed {
                    font-size: 11px;
                    margin-right: 1px;
                    margin-inline-start: initial;
                    margin-inline-end: 1px;
                }
                .wind-unit {
                    font-size: 9px;
                    margin-left: 1px;
                    margin-inline-start: 1px;
                    margin-inline-end: initial;
                }
                .current-time {
                    position: absolute;
                    top: 20px;
                    right: 16px;
                    inset-inline-start: initial;
                    inset-inline-end: 16px;
                    font-size: ${config.time_size}px;
                }
                .date-text {
                    font-size: ${config.day_date_size}px;
                    color: var(--secondary-text-color);
                }
                .main .feels-like {
                    font-size: 13px;
                    margin-top: 5px;
                    font-weight: 400;
                }
                .main .description {
                    font-style: italic;
                    font-size: 13px;
                    margin-top: 5px;
                    font-weight: 400;
                }
                .updated {
                    font-size: 13px;
                    align-items: end;
                    font-weight: 300;
                    margin-bottom: 1px;
                }
                .more-info {
                    cursor: pointer;
                }
            </style>

            <ha-card header="${config.title}">
                <div class="card">
                    ${this.renderMain()}
                    ${this.renderAttributes()}
                    <div class="chart-container">
                        <canvas id="forecastChart"></canvas>
                    </div>
                    ${this.renderForecastConditionIcons()}
                    ${this.renderWind()}
                    ${this.renderLastUpdated()}
                </div>
            </ha-card>
        `;
    }

    renderMain({ config, sun, weather, temperature, feels_like, description } = this) {
        if (!config?.show_main)
            return html``;

        const use12HourFormat = config.use_12hour_format;
        const showTime = config.show_time;
        const showDay = config.show_day;
        const showDate = config.show_date;
        const showFeelsLike = config.show_feels_like;
        const showDescription = config.show_description;
        const showCurrentCondition = config.show_current_condition;
        const showTemperature = config.show_temperature;
        const showSeconds = config.show_time_seconds;

        let roundedTemperature = temperature;
        if (!isNaN(roundedTemperature) && roundedTemperature % 1 !== 0) {
            roundedTemperature = Math.round(roundedTemperature * 10) / 10;
        }

        let roundedFeelsLike = feels_like;
        if (roundedFeelsLike && !isNaN(roundedFeelsLike) && roundedFeelsLike % 1 !== 0) {
            roundedFeelsLike = Math.round(roundedFeelsLike * 10) / 10;
        }

        const iconHtml = config.animated_icons || config.icons
            ? html`<img src="${this.getWeatherIcon(weather!.state, sun!.state)}" alt="">`
            : html`<ha-icon icon="${this.getWeatherIcon(weather!.state, sun!.state)}"></ha-icon>`;

        const updateClock = () => {
            const currentDate = new Date();
            const timeOptions: Intl.DateTimeFormatOptions = {
                hour12: use12HourFormat,
                hour: 'numeric',
                minute: 'numeric',
                second: showSeconds ? 'numeric' : undefined
            };
            const currentTime = currentDate.toLocaleTimeString(this.language, timeOptions);
            const currentDayOfWeek = currentDate.toLocaleString(this.language, { weekday: 'long' }).toUpperCase();
            const currentDateFormatted = currentDate.toLocaleDateString(this.language, { month: 'long', day: 'numeric' });

            const mainDiv = this.shadowRoot?.querySelector('.main');
            if (mainDiv) {
                const clockElement = mainDiv.querySelector('#digital-clock');
                if (clockElement) {
                    clockElement.textContent = currentTime;
                }
                if (showDay) {
                    const dayElement = mainDiv.querySelector('.date-text.day');
                    if (dayElement) {
                        dayElement.textContent = currentDayOfWeek;
                    }
                }
                if (showDate) {
                    const dateElement = mainDiv.querySelector('.date-text.date');
                    if (dateElement) {
                        dateElement.textContent = currentDateFormatted;
                    }
                }
            }
        };

        updateClock();

        if (showTime) {
            setInterval(updateClock, 1000);
        }

        return html`
            <div class="main">
                ${iconHtml}
                <div>
                    <div>
                        ${showTemperature ? html`
                            <div 
                                @click="${() => { if (config.temp) this.showMoreInfo(config.temp); }}"
                                class="${config.temp ? 'more-info' : '' }"
                            >
                                ${roundedTemperature}<span>${this.getUnit('temperature')}</span>
                            </div>
                        ` : ''}
                        ${showFeelsLike && roundedFeelsLike ? html`
                            <div class="feels-like">
                                ${this.ll('feelsLike')}
                                ${roundedFeelsLike}${this.getUnit('temperature')}
                            </div>
                        ` : ''}
                        ${showCurrentCondition ? html`
                            <div class="current-condition">
                                <span>${this.ll(weather!.state)}</span>
                            </div>
                        ` : ''}
                        ${showDescription ? html`
                            <div class="description">
                                ${description}
                            </div>
                        ` : ''}
                    </div>
                    ${showTime ? html`
                        <div class="current-time">
                            <div id="digital-clock"></div>
                            ${showDay ? html`<div class="date-text day"></div>` : ''}
                            ${showDay && showDate ? html` ` : ''}
                            ${showDate ? html`<div class="date-text date"></div>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderAttributes({ config, humidity, pressure, windSpeed, windDirection, sun, uv_index, dew_point, wind_gust_speed, visibility } = this) {
        let dWindSpeed = windSpeed;
        let dPressure = pressure;

        if (this.unitSpeed !== this.weather?.attributes.wind_speed_unit && windSpeed) {
            if (this.unitSpeed === 'm/s') {
                if (this.weather?.attributes.wind_speed_unit === 'km/h') {
                    dWindSpeed = Math.round(windSpeed * 1000 / 3600);
                } else if (this.weather?.attributes.wind_speed_unit === 'mph') {
                    dWindSpeed = Math.round(windSpeed * 0.44704);
                }
            } else if (this.unitSpeed === 'km/h') {
                if (this.weather?.attributes.wind_speed_unit === 'm/s') {
                    dWindSpeed = Math.round(windSpeed * 3.6);
                } else if (this.weather?.attributes.wind_speed_unit === 'mph') {
                    dWindSpeed = Math.round(windSpeed * 1.60934);
                }
            } else if (this.unitSpeed === 'mph') {
                if (this.weather?.attributes.wind_speed_unit === 'm/s') {
                    dWindSpeed = Math.round(windSpeed / 0.44704);
                } else if (this.weather?.attributes.wind_speed_unit === 'km/h') {
                    dWindSpeed = Math.round(windSpeed / 1.60934);
                }
            } else if (this.unitSpeed === 'Bft') {
                dWindSpeed = this.calculateBeaufortScale(windSpeed);
            }
        } else if (dWindSpeed) {
            dWindSpeed = Math.round(dWindSpeed);
        }

        if (this.unitPressure !== this.weather?.attributes.pressure_unit && pressure) {
            if (this.unitPressure === 'mmHg') {
                if (this.weather?.attributes.pressure_unit === 'hPa') {
                    dPressure = Math.round(pressure * 0.75006);
                } else if (this.weather?.attributes.pressure_unit === 'inHg') {
                    dPressure = Math.round(pressure * 25.4);
                }
            } else if (this.unitPressure === 'hPa') {
                if (this.weather?.attributes.pressure_unit === 'mmHg') {
                    dPressure = Math.round(pressure / 0.75006);
                } else if (this.weather?.attributes.pressure_unit === 'inHg') {
                    dPressure = Math.round(pressure * 33.8639);
                }
            } else if (this.unitPressure === 'inHg') {
                if (this.weather?.attributes.pressure_unit === 'mmHg') {
                    dPressure = pressure / 25.4;
                } else if (this.weather?.attributes.pressure_unit === 'hPa') {
                    dPressure = pressure / 33.8639;
                }
            }
        } else if (dPressure) {
            if (this.unitPressure === 'hPa' || this.unitPressure === 'mmHg') {
                dPressure = Math.round(dPressure);
            }
        }

        if (!config?.show_attributes)
            return html``;

        const showHumidity = config.show_humidity;
        const showPressure = config.show_pressure;
        const showWindDirection = config.show_wind_direction;
        const showWindSpeed = config.show_wind_speed;
        const showSun = config.show_sun;
        const showDewpoint = config.show_dew_point;
        const showWindgustspeed = config.show_wind_gust_speed;
        const showVisibility = config.show_visibility;

        return html`
            <div class="attributes">
                ${((showHumidity && humidity) || (showPressure && dPressure) || (showDewpoint && dew_point) || (showVisibility && visibility)) ? html`
                    <div>
                        ${showHumidity && humidity ? html`
                            <div
                                @click="${() => { if (config.humid) this.showMoreInfo(config.humid); }}"
                                class="${config.humid ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:water-percent"></ha-icon> ${humidity} %
                            </div>
                        ` : ''}
                        ${showPressure && dPressure && this.unitPressure ? html`
                            <div
                                @click="${() => { if (config.press) this.showMoreInfo(config.press); }}"
                                class="${config.press ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:gauge"></ha-icon> ${dPressure} ${this.units[this.unitPressure]}
                            </div>
                        ` : ''}
                        ${showDewpoint && dew_point ? html`
                            <div
                                @click="${() => { if (config.dew_point) this.showMoreInfo(config.dew_point); }}"
                                class="${config.dew_point ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:thermometer-water"></ha-icon> ${dew_point} ${this.weather?.attributes.temperature_unit}
                            </div>
                        ` : ''}
                        ${showVisibility && visibility ? html`
                            <div
                                @click="${() => { if (config.visibility) this.showMoreInfo(config.visibility); }}"
                                class="${config.visibility ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:eye"></ha-icon> ${visibility} ${this.weather?.attributes.visibility_unit}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                ${((showSun && sun) || (uv_index)) ? html`
                    <div>
                        ${uv_index ? html`
                            <div
                                @click="${() => { if (config.uv) this.showMoreInfo(config.uv); }}"
                                class="${config.uv ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:white-balance-sunny"></ha-icon> UV: ${Math.round(uv_index * 10) / 10}
                            </div>
                        ` : ''}
                        ${showSun && sun ? html`
                            <div>
                                ${this.renderSun()}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                ${((showWindDirection && windDirection) || (showWindSpeed && dWindSpeed)) ? html`
                    <div>
                        ${showWindDirection && windDirection  ? html`
                            <div
                                @click="${() => { if (config.winddir) this.showMoreInfo(config.winddir); }}"
                                class="${config.winddir ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:${this.getWindDirIcon(windDirection)}"></ha-icon> ${this.getWindDir(windDirection)} 
                            </div>
                        ` : ''}
                        ${showWindSpeed && dWindSpeed && this.unitSpeed ? html`
                            <div
                                @click="${() => { if (config.windspeed) this.showMoreInfo(config.windspeed); }}"
                                class="${config.windspeed ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:weather-windy"></ha-icon> ${dWindSpeed} ${this.units[this.unitSpeed]}
                            </div>
                        ` : ''}
                        ${showWindgustspeed && wind_gust_speed && this.unitSpeed ? html`
                            <div
                                @click="${() => { if (config.wind_gust_speed) this.showMoreInfo(config.wind_gust_speed); }}"
                                class="${config.wind_gust_speed ? 'more-info' : '' }"
                            >
                                <ha-icon icon="hass:weather-windy-variant"></ha-icon> ${wind_gust_speed} ${this.units[this.unitSpeed]}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderSun({ sun, language } = this) {
        if (sun === undefined) {
            return html``;
        }

        const use12HourFormat = this.config?.use_12hour_format;
        const timeOptions: Intl.DateTimeFormatOptions = {
            hour12: use12HourFormat,
            hour: 'numeric',
            minute: 'numeric'
        };

        return html`
            <ha-icon icon="mdi:weather-sunset-up"></ha-icon>
            ${new Date(sun?.attributes.next_rising).toLocaleTimeString(language, timeOptions)}<br>
            <ha-icon icon="mdi:weather-sunset-down"></ha-icon>
            ${new Date(sun?.attributes.next_setting).toLocaleTimeString(language, timeOptions)}
        `;
    }

    renderForecastConditionIcons({ config, forecastItems, sun } = this) {
        const forecast = this.forecasts ? this.forecasts.slice(0, forecastItems) : [];

        if (!config?.forecast.condition_icons) {
            return html``;
        }

        return html`
            <div class="conditions" @click="${() => { this.showMoreInfo(config.entity); }}">
                ${forecast.map((item) => {
                    const forecastTime = new Date(item.datetime);
                    const sunriseTime = new Date(sun!.attributes.next_rising);
                    const sunsetTime = new Date(sun!.attributes.next_setting);

                    // Adjust sunrise and sunset times to match the date of forecastTime
                    const adjustedSunriseTime = new Date(forecastTime);
                    adjustedSunriseTime.setHours(sunriseTime.getHours());
                    adjustedSunriseTime.setMinutes(sunriseTime.getMinutes());
                    adjustedSunriseTime.setSeconds(sunriseTime.getSeconds());

                    const adjustedSunsetTime = new Date(forecastTime);
                    adjustedSunsetTime.setHours(sunsetTime.getHours());
                    adjustedSunsetTime.setMinutes(sunsetTime.getMinutes());
                    adjustedSunsetTime.setSeconds(sunsetTime.getSeconds());

                    let isDayTime;

                    if (config.forecast.type === 'daily') {
                        // For a daily forecast, assume it's daytime
                        isDayTime = true;
                    } else {
                        // For other forecast types, determine based on sunrise and sunset times
                        isDayTime = forecastTime >= adjustedSunriseTime && forecastTime <= adjustedSunsetTime;
                    }

                    const weatherIcons = isDayTime ? weatherIconsDay : weatherIconsNight;
                    const condition = item.condition!;

                    let iconHtml;

                    if (config.animated_icons || config.icons) {
                        const iconSrc = config.animated_icons ?
                                `${this.baseIconPath}${weatherIcons[condition]}.svg` :
                                `${this.config?.icons}${weatherIcons[condition]}.svg`;
                        iconHtml = html`<img class="icon" src="${iconSrc}" alt="">`;
                    } else {
                        iconHtml = html`<ha-icon icon="${this.getWeatherIcon(condition, sun!.state)}"></ha-icon>`;
                    }

                    return html`
                        <div class="forecast-item">
                            ${iconHtml}
                        </div>
                    `;
                })}
            </div>
        `;
    }

    renderWind({ config, forecastItems } = this) {
        const showWindForecast = config?.forecast.show_wind_forecast;

        if (!showWindForecast) {
            return html``;
        }

        const forecast = this.forecasts ? this.forecasts.slice(0, forecastItems) : [];

        return html`
            <div class="wind-details">
                ${showWindForecast ? html`
                    ${forecast.map((item) => {
                        let dWindSpeed = item.wind_speed;

                        if (dWindSpeed && this.unitSpeed !== this.weather?.attributes.wind_speed_unit) {
                            if (this.unitSpeed === 'm/s') {
                                if (this.weather?.attributes.wind_speed_unit === 'km/h') {
                                    dWindSpeed = Math.round(dWindSpeed * 1000 / 3600);
                                } else if (this.weather?.attributes.wind_speed_unit === 'mph') {
                                    dWindSpeed = Math.round(dWindSpeed * 0.44704);
                                }
                            } else if (this.unitSpeed === 'km/h') {
                                if (this.weather?.attributes.wind_speed_unit === 'm/s') {
                                    dWindSpeed = Math.round(dWindSpeed * 3.6);
                                } else if (this.weather?.attributes.wind_speed_unit === 'mph') {
                                    dWindSpeed = Math.round(dWindSpeed * 1.60934);
                                }
                            } else if (this.unitSpeed === 'mph') {
                                if (this.weather?.attributes.wind_speed_unit === 'm/s') {
                                    dWindSpeed = Math.round(dWindSpeed / 0.44704);
                                } else if (this.weather?.attributes.wind_speed_unit === 'km/h') {
                                    dWindSpeed = Math.round(dWindSpeed / 1.60934);
                                }
                            } else if (this.unitSpeed === 'Bft') {
                                dWindSpeed = this.calculateBeaufortScale(dWindSpeed);
                            }
                        } else if (dWindSpeed) {
                            dWindSpeed = Math.round(dWindSpeed);
                        }

                        return html`
                            <div class="wind-detail">
                                <ha-icon class="wind-icon" icon="hass:${this.getWindDirIcon(item.wind_bearing!)}"></ha-icon>
                                <span class="wind-speed">${dWindSpeed}</span>
                                <span class="wind-unit">${this.units[this.unitSpeed!]}</span>
                            </div>
                        `;
                    })}
                ` : ''}
            </div>
        `;
    }

    renderLastUpdated() {
        const lastUpdatedString = this.weather!.last_changed;
        const lastUpdatedTimestamp = new Date(lastUpdatedString!).getTime();
        const currentTimestamp = Date.now();
        const timeDifference = currentTimestamp - lastUpdatedTimestamp;

        const minutesAgo = Math.floor(timeDifference / (1000 * 60));
        const hoursAgo = Math.floor(minutesAgo / 60);

        const locale = this.language;

        const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

        let formattedLastUpdated;

        if (hoursAgo > 0) {
            formattedLastUpdated = formatter.format(-hoursAgo, 'hour');
        } else {
            formattedLastUpdated = formatter.format(-minutesAgo, 'minute');
        }

        const showLastUpdated = this.config?.show_last_changed;

        if (!showLastUpdated) {
            return html``;
        }

        return html`
            <div class="updated">
                <div>
                    ${formattedLastUpdated}
                </div>
            </div>
        `;
    }

    showMoreInfo(entity: string) {
        const node = this.shadowRoot;
        const event = new CustomEvent('hass-more-info', {
            bubbles: true,
            composed: true,
            detail: { entityId: entity },
        });
        node!.dispatchEvent(event);
    }
}

declare global {
    interface Window {
        customCards?: unknown[];
    }
}

window.customCards = window.customCards ?? [];
window.customCards.push({
    type: "weather-chart-card",
    name: "Weather Chart Card",
    description: "A custom weather card with chart.",
    preview: true,
    documentationURL: "https://github.com/smitterson/weather-chart-card",
});

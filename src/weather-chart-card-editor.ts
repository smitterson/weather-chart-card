import {LitElement, html, PropertyValues} from 'lit';
import {customElement, property, state} from "lit/decorators.js";
import {HomeAssistant, LovelaceCardConfig, LovelaceCardEditor} from "custom-card-helpers";
import {WeatherChartCardConfig} from "./types";

const ALT_SCHEMA = [
    { name: "temp", title: "Alternative temperature sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "feels_like", title: "Alternative feels like temperature sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "description", title: "Alternative weather description sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "press", title: "Alternative pressure sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "humid", title: "Alternative humidity sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "uv", title: "Alternative UV index sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "winddir", title: "Alternative wind bearing sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "windspeed", title: "Alternative wind speed sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "dew_point", title: "Alternative dew pointsensor", selector: { entity: { domain: 'sensor' } } },
    { name: "wind_gust_speed", title: "Alternative wind gust speed sensor", selector: { entity: { domain: 'sensor' } } },
    { name: "visibility", title: "Alternative visibility sensor", selector: { entity: { domain: 'sensor' } } },
];

@customElement('weather-chart-card-editor')
export class WeatherChartCardEditor extends LitElement implements LovelaceCardEditor {
    @property({ attribute: false }) public hass!: HomeAssistant;

    @state() private _config!: WeatherChartCardConfig;
    @state() private currentPage: string;
    @state() private _entity: string;
    @state() private entities: any[];

    private hasApparentTemperature = false
    private hasDewpoint = false
    private hasWindgustspeed = false
    private hasVisibility = false
    private hasDescription = false

    constructor() {
        super();
        this.currentPage = 'card';
        this._entity = '';
        this.entities = [];
        this._formValueChanged = this._formValueChanged.bind(this);
    }

    public setConfig(config: LovelaceCardConfig & WeatherChartCardConfig) {
        if (!config) {
            throw new Error("Invalid configuration");
        }
        this._config = config;
        this._entity = config.entity || '';
        this.hasApparentTemperature = (
            this.hass &&
            this.hass.states[config.entity] &&
            this.hass.states[config.entity].attributes &&
            this.hass.states[config.entity].attributes.apparent_temperature !== undefined
        ) || config.feels_like !== undefined;
        this.hasDewpoint = (
            this.hass &&
            this.hass.states[config.entity] &&
            this.hass.states[config.entity].attributes &&
            this.hass.states[config.entity].attributes.dew_point !== undefined
        ) || config.dew_point !== undefined;
        this.hasWindgustspeed = (
            this.hass &&
            this.hass.states[config.entity] &&
            this.hass.states[config.entity].attributes &&
            this.hass.states[config.entity].attributes.wind_gust_speed !== undefined
        ) || config.wind_gust_speed !== undefined;
        this.hasVisibility = (
            this.hass &&
            this.hass.states[config.entity] &&
            this.hass.states[config.entity].attributes &&
            this.hass.states[config.entity].attributes.visibility !== undefined
        ) || config.visibility !== undefined;
        this.hasDescription = (
            this.hass &&
            this.hass.states[config.entity] &&
            this.hass.states[config.entity].attributes &&
            this.hass.states[config.entity].attributes.description !== undefined
        ) || config.description !== undefined;
        this.fetchEntities();
        this.requestUpdate();
    }

    get config() {
        return this._config;
    }

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has('hass')) {
            this.fetchEntities();
        }
        if (changedProperties.has('_config') && this._config?.entity) {
            this._entity = this._config.entity;
        }
    }

    fetchEntities() {
        if (this.hass) {
            this.entities = Object.keys(this.hass.states).filter((e) => e.startsWith('weather.'));
            this.requestUpdate();
        }
    }

    _EntityChanged(event: Event, _key: string) {
        if (!this._config) {
            return;
        }
        const target = event.target as HTMLInputElement;
        const newConfig = { ...this._config };
        newConfig.entity = target.value;
        this._entity = target.value;
        this.configChanged(newConfig);
    }

    configChanged(newConfig: WeatherChartCardConfig) {
        const event = new CustomEvent("config-changed", {
            bubbles: true,
            composed: true,
            detail: { config: newConfig }
        });
        this.dispatchEvent(event);
    }

    _valueChanged(event: Event, key: string) {
        if (!this._config) {
            return;
        }

        const target = event.target as HTMLInputElement;
        const newConfig = { ...this._config };

        if (key.includes('.')) {
            const parts = key.split('.');
            let currentLevel = newConfig;

            for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];

                currentLevel[part] = { ...currentLevel[part] };

                currentLevel = currentLevel[part];
            }

            const finalKey = parts[parts.length - 1];
            if (target.checked !== undefined) {
                currentLevel[finalKey] = target.checked;
            } else {
                currentLevel[finalKey] = target.value;
            }
        } else {
            if (target.checked !== undefined) {
                newConfig[key] = target.checked;
            } else {
                newConfig[key] = target.value;
            }
        }

        this.configChanged(newConfig);
        this.requestUpdate();
    }

    _handleStyleChange(event: Event) {
        if (!this._config) {
            return;
        }
        const target = event.target as HTMLInputElement;
        const newConfig = JSON.parse(JSON.stringify(this._config));
        newConfig.forecast.style = target.value;
        this.configChanged(newConfig);
        this.requestUpdate();
    }

    _handleTypeChange(event: Event) {
        if (!this._config) {
            return;
        }
        const target = event.target as HTMLInputElement;
        const newConfig = JSON.parse(JSON.stringify(this._config));
        newConfig.forecast.type = target.value;
        this.configChanged(newConfig);
        this.requestUpdate();
    }

    _handleIconStyleChange(event: Event) {
        if (!this._config) {
            return;
        }
        const target = event.target as HTMLInputElement;
        const newConfig = JSON.parse(JSON.stringify(this._config));
        newConfig.icon_style = target.value;
        this.configChanged(newConfig);
        this.requestUpdate();
    }

    _formValueChanged(event: CustomEvent) {
        const target = event.target as HTMLInputElement;
        if (target.tagName.toLowerCase() === 'ha-form') {
            const newConfig = event.detail.value;
            this.configChanged(newConfig);
            this.requestUpdate();
        }
    }

    showPage(pageName: string) {
        this.currentPage = pageName;
        this.requestUpdate();
    }

    render() {
        if (this._config && this._config.entity !== this._entity) {
            this._entity = this._config.entity;
        }
        const forecastConfig = this._config.forecast || {};
        const unitsConfig = this._config.units || {};

        return html`
            <style>
                .switch-label {
                    padding-left: 14px;
                }
                .switch-container {
                    margin-bottom: 12px;
                }
                .page-container {
                    display: none;
                }
                .page-container.active {
                    display: block;
                }
                .time-container {
                    display: flex;
                    flex-direction: row;
                    margin-bottom: 12px;
                }
                .icon-container {
                    display: flex;
                    flex-direction: row;
                    margin-bottom: 12px;
                }
                .switch-right {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                }
                .checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .textfield-container {
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 10px;
                    gap: 20px;
                }
                .radio-container {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                }
                .radio-group {
                    display: flex;
                    align-items: center;
                }
                .radio-group label {
                    margin-left: 4px;
                }
                div.buttons-container {
                    border-bottom: 2px solid #ccc;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .flex-container {
                    display: flex;
                    flex-direction: row;
                    gap: 20px;
                }
                .flex-container ha-textfield {
                    flex-basis: 50%;
                    flex-grow: 1;
                }
            </style>
            <div>
                <div class="textfield-container">
                    <ha-select
                        naturalMenuWidth
                        fixedMenuPosition
                        label="Entity"
                        .configValue=${'entity'}
                        .value=${this._entity}
                        @change=${(e: Event) => this._EntityChanged(e, 'entity')}
                        @closed=${(ev: Event) => ev.stopPropagation()}
                    >
                        ${this.entities.map((entity) => html`<ha-list-item .value=${entity}>${entity}</ha-list-item>`)}
                    </ha-select>
                    <ha-textfield
                        label="Title"
                        .value="${this._config.title ?? ''}"
                        @change="${(e: Event) => this._valueChanged(e, 'title')}"
                    ></ha-textfield>
                </div>

                <h5>Forecast type:</h5>

                <div class="radio-group">
                    <ha-radio
                        name="type"
                        value="daily"
                        @change="${this._handleTypeChange}"
                        .checked="${forecastConfig.type === 'daily'}"
                    ></ha-radio>
                    <label class="check-label">
                        Daily forecast
                    </label>
                </div>

                <div class="radio-group">
                    <ha-radio
                        name="type"
                        value="hourly"
                        @change="${this._handleTypeChange}"
                        .checked="${forecastConfig.type === 'hourly'}"
                    ></ha-radio>
                    <label class="check-label">
                        Hourly forecast
                    </label>
                </div>

                <h5>Chart style:</h5>
                <div class="radio-container">
                    <div class="switch-right">
                        <ha-radio
                            name="style"
                            value="style1"
                            @change="${this._handleStyleChange}"
                            .checked="${forecastConfig.style === 'style1'}"
                        ></ha-radio>
                        <label class="check-label">
                            Chart style 1
                        </label>
                    </div>

                    <div class="switch-right">
                        <ha-radio
                            name="style"
                            value="style2"
                            @change="${this._handleStyleChange}"
                            .checked="${forecastConfig.style === 'style2'}"
                        ></ha-radio>
                        <label class="check-label">
                            Chart style 2
                        </label>
                    </div>
                </div>

                <!-- Buttons to switch between pages -->
                <h4>Settings:</h4>
                <div class="buttons-container">
                    <mwc-button @click="${() => this.showPage('card')}">Main</mwc-button>
                    <mwc-button @click="${() => this.showPage('forecast')}">Forecast</mwc-button>
                    <mwc-button @click="${() => this.showPage('units')}">Units</mwc-button>
                    <mwc-button @click="${() => this.showPage('alternate')}">Alternate entities</mwc-button>
                </div>

                <!-- Card Settings Page -->
                <div class="page-container ${this.currentPage === 'card' ? 'active' : ''}">
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_main')}"
                            .checked="${(this._config.show_main)}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Main
                        </label>
                    </div>
                    <div class="switch-container">
                        ${this.hasApparentTemperature ? html`
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'show_feels_like')}"
                                .checked="${(this._config.show_feels_like)}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show Feels Like Temperature
                            </label>
                        ` : ''}
                    </div>
                    <div class="switch-container">
                        ${this.hasDescription ? html`
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'show_description')}"
                                .checked="${(this._config.show_description)}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show Weather Description
                            </label>
                        ` : ''}
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_temperature')}"
                            .checked="${(this._config.show_temperature)}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Current Temperature
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_current_condition')}"
                            .checked="${this._config.show_current_condition}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Current Weather Condition
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_attributes')}"
                            .checked="${this._config.show_attributes}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Attributes
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_humidity')}"
                            .checked="${this._config.show_humidity}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Humidity
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_pressure')}"
                            .checked="${this._config.show_pressure}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Pressure
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_sun')}"
                            .checked="${this._config.show_sun}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Sun
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_wind_direction')}"
                            .checked="${this._config.show_wind_direction}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Wind Direction
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_wind_speed')}"
                            .checked="${this._config.show_wind_speed}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Wind Speed
                        </label>
                    </div>
                    <div class="switch-container">
                        ${this.hasDewpoint ? html`
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'show_dew_point')}"
                                .checked="${this._config.show_dew_point}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show Dew Point
                            </label>
                        ` : ''}
                    </div>
                    <div class="switch-container">
                        ${this.hasWindgustspeed ? html`
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'show_wind_gust_speed')}"
                                .checked="${this._config.show_wind_gust_speed}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show Wind Gust Speed
                            </label>
                        ` : ''}
                    </div>
                    <div class="switch-container">
                        ${this.hasVisibility ? html`
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'show_visibility')}"
                                .checked="${this._config.show_visibility}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show Visibility
                            </label>
                        ` : ''}
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'show_last_changed')}"
                            .checked="${this._config.show_last_changed}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show when last data changed
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'use_12hour_format')}"
                            .checked="${this._config.use_12hour_format}"
                        ></ha-switch>
                        <label class="switch-label">
                            Use 12-Hour Format
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'autoscroll')}"
                            .checked="${this._config.autoscroll}"
                        ></ha-switch>
                        <label class="switch-label">
                            Autoscroll
                        </label>
                    </div>
                    <div class="time-container">
                        <div class="switch-right">
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'show_time')}"
                                .checked="${this._config.show_time}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show Current Time
                            </label>
                        </div>
                        <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
                            <ha-checkbox
                                @change="${(e: Event) => this._valueChanged(e, 'show_time_seconds')}"
                                .checked="${this._config.show_time_seconds}"
                            ></ha-checkbox>
                            <label class="check-label">
                                Show Seconds
                            </label>
                        </div>
                        <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
                            <ha-checkbox
                                @change="${(e: Event) => this._valueChanged(e, 'show_day')}"
                                .checked="${this._config.show_day}"
                            ></ha-checkbox>
                            <label class="check-label">
                                Show Day
                            </label>
                        </div>
                        <div class="switch-right checkbox-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
                            <ha-checkbox
                                @change="${(e: Event) => this._valueChanged(e, 'show_date')}"
                                .checked="${this._config.show_date}"
                            ></ha-checkbox>
                            <label class="check-label">
                                Show Date
                            </label>
                        </div>
                    </div>
                    <div class="flex-container" style="${this._config.show_time ? 'display: flex;' : 'display: none;'}">
                        <ha-textfield
                            label="Time text size"
                            type="number"
                            .value="${this._config.time_size || '26'}"
                            @change="${(e: Event) => this._valueChanged(e, 'time_size')}"
                        ></ha-textfield>
                        <ha-textfield
                            label="Day and date text size"
                            type="number"
                            .value="${this._config.day_date_size || '15'}"
                            @change="${(e: Event) => this._valueChanged(e, 'day_date_size')}"
                        ></ha-textfield>
                    </div>
                    <div class="icon-container">
                        <div class="switch-right">
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'animated_icons')}"
                                .checked="${this._config.animated_icons}"
                            ></ha-switch>
                            <label class="switch-label">
                                Use Animated Icons
                            </label>
                        </div>
                        <div class="switch-right radio-container" style="${this._config.animated_icons ? 'display: flex;' : 'display: none;'}">
                            <ha-radio
                                name="icon_style"
                                value="style1"
                                @change="${this._handleIconStyleChange}"
                                .checked="${this._config.icon_style === 'style1'}"
                            ></ha-radio>
                            <label class="check-label">
                                Style 1
                            </label>
                        </div>
                        <div class="switch-right radio-container" style="${this._config.animated_icons ? 'display: flex;' : 'display: none;'}">
                            <ha-radio
                                name="icon_style"
                                value="style2"
                                @change="${this._handleIconStyleChange}"
                                .checked="${this._config.icon_style === 'style2'}"
                            ></ha-radio>
                            <label class="check-label">
                                Style 2
                            </label>
                        </div>
                    </div>
                    <div class="textfield-container">
                        <ha-textfield
                            label="Icon Size for animated or custom icons"
                            type="number"
                            .value="${this._config.icons_size || '25'}"
                            @change="${(e: Event) => this._valueChanged(e, 'icons_size')}"
                        ></ha-textfield>
                        <ha-textfield
                            label="Curent temperature Font Size"
                            type="number"
                            .value="${this._config.current_temp_size || '28'}"
                            @change="${(e: Event) => this._valueChanged(e, 'current_temp_size')}"
                        ></ha-textfield>
                        <ha-textfield
                            label="Custom icon path"
                            .value="${this._config.icons ?? ''}"
                            @change="${(e: Event) => this._valueChanged(e, 'icons')}"
                        ></ha-textfield>
                        <ha-select
                            naturalMenuWidth
                            fixedMenuPosition
                            label="Select custom language"
                            .configValue=${''}
                                    .value=${this._config.locale}
                            @change=${(e: Event) => this._valueChanged(e, 'locale')}
                            @closed=${(ev: Event) => ev.stopPropagation()}
                        >
                            <ha-list-item .value=${''}>HA Default</ha-list-item>
                            <ha-list-item .value=${'bg'}>Bulgarian</ha-list-item>
                            <ha-list-item .value=${'ca'}>Catalan</ha-list-item>
                            <ha-list-item .value=${'cs'}>Czech</ha-list-item>
                            <ha-list-item .value=${'da'}>Danish</ha-list-item>
                            <ha-list-item .value=${'nl'}>Dutch</ha-list-item>
                            <ha-list-item .value=${'en'}>English</ha-list-item>
                            <ha-list-item .value=${'fi'}>Finnish</ha-list-item>
                            <ha-list-item .value=${'fr'}>French</ha-list-item>
                            <ha-list-item .value=${'de'}>German</ha-list-item>
                            <ha-list-item .value=${'el'}>Greek</ha-list-item>
                            <ha-list-item .value=${'hu'}>Hungarian</ha-list-item>
                            <ha-list-item .value=${'it'}>Italian</ha-list-item>
                            <ha-list-item .value=${'lt'}>Lithuanian</ha-list-item>
                            <ha-list-item .value=${'no'}>Norwegian</ha-list-item>
                            <ha-list-item .value=${'pl'}>Polish</ha-list-item>
                            <ha-list-item .value=${'pt'}>Portuguese</ha-list-item>
                            <ha-list-item .value=${'ro'}>Romanian</ha-list-item>
                            <ha-list-item .value=${'ru'}>Russian</ha-list-item>
                            <ha-list-item .value=${'sk'}>Slovak</ha-list-item>
                            <ha-list-item .value=${'es'}>Spanish</ha-list-item>
                            <ha-list-item .value=${'sv'}>Swedish</ha-list-item>
                            <ha-list-item .value=${'uk'}>Ukrainian</ha-list-item>
                            <ha-list-item .value=${'ko'}>한국어</ha-list-item>
                        </ha-select>
                    </div>
                </div>

                <!-- Forecast Settings Page -->
                <div class="page-container ${this.currentPage === 'forecast' ? 'active' : ''}">
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'forecast.condition_icons')}"
                            .checked="${forecastConfig.condition_icons}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Condition Icons
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'forecast.show_wind_forecast')}"
                            .checked="${forecastConfig.show_wind_forecast}"
                        ></ha-switch>
                        <label class="switch-label">
                            Show Wind Forecast
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'forecast.round_temp')}"
                            .checked="${forecastConfig.round_temp}"
                        ></ha-switch>
                        <label class="switch-label">
                            Rounding Temperatures
                        </label>
                    </div>
                    <div class="switch-container">
                        <ha-switch
                            @change="${(e: Event) => this._valueChanged(e, 'forecast.disable_animation')}"
                            .checked="${forecastConfig.disable_animation}"
                        ></ha-switch>
                        <label class="switch-label">
                            Disable Chart Animation
                        </label>
                    </div>
                    <div class="textfield-container">
                        <ha-select
                            naturalMenuWidth
                            fixedMenuPosition
                            label="Precipitation Type (Probability if supported by the weather entity)"
                            .configValue=${'forecast.precipitation_type'}
                            .value=${forecastConfig.precipitation_type}
                            @change=${(e: Event) => this._valueChanged(e, 'forecast.precipitation_type')}
                            @closed=${(ev: Event) => ev.stopPropagation()}
                        >
                            <ha-list-item .value=${'rainfall'}>Rainfall</ha-list-item>
                            <ha-list-item .value=${'probability'}>Probability</ha-list-item>
                        </ha-select>
                        <div class="switch-container" ?hidden=${forecastConfig.precipitation_type !== 'rainfall'}>
                            <ha-switch
                                @change="${(e: Event) => this._valueChanged(e, 'forecast.show_probability')}"
                                .checked="${forecastConfig.show_probability}"
                            ></ha-switch>
                            <label class="switch-label">
                                Show precipitation probability
                            </label>
                        </div>
                        <div class="textfield-container">
                            <div class="flex-container">
                                <ha-textfield
                                    label="Precipitation Bar Size %"
                                    type="number"
                                    max="100"
                                    min="0"
                                    .value="${forecastConfig.precip_bar_size || '100'}"
                                    @change="${(e: Event) => this._valueChanged(e, 'forecast.precip_bar_size')}"
                                ></ha-textfield>
                                <ha-textfield
                                    label="Labels Font Size"
                                    type="number"
                                    .value="${forecastConfig.labels_font_size || '11'}"
                                    @change="${(e: Event) => this._valueChanged(e, 'forecast.labels_font_size')}"
                                ></ha-textfield>
                            </div>
                            <div class="flex-container">
                                <ha-textfield
                                    label="Chart height"
                                    type="number"
                                    .value="${forecastConfig.chart_height || '180'}"
                                    @change="${(e: Event) => this._valueChanged(e, 'forecast.chart_height')}"
                                ></ha-textfield>
                                <ha-textfield
                                    label="Number of forecasts"
                                    type="number"
                                    .value="${forecastConfig.number_of_forecasts || '0'}"
                                    @change="${(e: Event) => this._valueChanged(e, 'forecast.number_of_forecasts')}"
                                ></ha-textfield>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Units Page -->
                <div class="page-container ${this.currentPage === 'units' ? 'active' : ''}">
                    <div class="textfield-container">
                        <ha-select
                            naturalMenuWidth
                            fixedMenuPosition
                            label="Convert pressure to"
                            .configValue=${'units.pressure'}
                            .value=${unitsConfig.pressure}
                            @change=${(e: Event) => this._valueChanged(e, 'units.pressure')}
                            @closed=${(ev: Event) => ev.stopPropagation()}
                        >
                            <ha-list-item .value=${'hPa'}>hPa</ha-list-item>
                            <ha-list-item .value=${'mmHg'}>mmHg</ha-list-item>
                            <ha-list-item .value=${'inHg'}>inHg</ha-list-item>
                        </ha-select>
                        <ha-select
                            naturalMenuWidth
                            fixedMenuPosition
                            label="Convert wind speed to"
                            .configValue=${'units.speed'}
                            .value=${unitsConfig.speed}
                            @change=${(e: Event) => this._valueChanged(e, 'units.speed')}
                            @closed=${(ev: Event) => ev.stopPropagation()}
                        >
                            <ha-list-item .value=${'km/h'}>km/h</ha-list-item>
                            <ha-list-item .value=${'m/s'}>m/s</ha-list-item>
                            <ha-list-item .value=${'Bft'}>Bft</ha-list-item>
                            <ha-list-item .value=${'mph'}>mph</ha-list-item>
                        </ha-select>
                    </div>
                </div>

                <!-- Alternate Page -->
                <div class="page-container ${this.currentPage === 'alternate' ? 'active' : ''}">
                    <h5>Alternative sensors for the main card attributes:</h5>
                    <ha-form
                        .data=${this._config}
                        .schema=${ALT_SCHEMA}
                        .hass=${this.hass}
                        @value-changed=${this._formValueChanged}
                    ></ha-form>
                </div>
        `;
    }
}
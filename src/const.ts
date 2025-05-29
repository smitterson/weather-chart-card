const cardinalDirectionsIcon = [
    'arrow-down', 'arrow-bottom-left', 'arrow-left',
    'arrow-top-left', 'arrow-up', 'arrow-top-right',
    'arrow-right', 'arrow-bottom-right', 'arrow-down'
];

const weatherIcons: Record<string, string> = {
    'clear-night': 'hass:weather-night',
    'cloudy': 'hass:weather-cloudy',
    'exceptional': 'mdi:alert-circle-outline',
    'fog': 'hass:weather-fog',
    'hail': 'hass:weather-hail',
    'lightning': 'hass:weather-lightning',
    'lightning-rainy': 'hass:weather-lightning-rainy',
    'partlycloudy': 'hass:weather-partly-cloudy',
    'pouring': 'hass:weather-pouring',
    'rainy': 'hass:weather-rainy',
    'snowy': 'hass:weather-snowy',
    'snowy-rainy': 'hass:weather-snowy-rainy',
    'sunny': 'hass:weather-sunny',
    'windy': 'hass:weather-windy',
    'windy-variant': 'hass:weather-windy-variant'
};

const weatherIconsDay: Record<string, string> = {
    'clear-night': 'clear-night',
    'cloudy': 'cloudy',
    'exceptional': 'exceptional',
    'fog': 'fog',
    'hail': 'hail',
    'lightning': 'lightning',
    'lightning-rainy': 'lightning-rain',
    'partlycloudy': 'partlycloudy-day',
    'pouring': 'pouring',
    'rainy': 'rain',
    'snowy': 'snow',
    'snowy-rainy': 'sleet',
    'sunny': 'clear-day',
    'windy': 'wind',
    'windy-variant': 'wind',
};

const weatherIconsNight: Record<string, string> = {
    ...weatherIconsDay,
    'sunny': 'clear-night',
    'partlycloudy': 'partlycloudy-night',
};



export {
    cardinalDirectionsIcon,
    weatherIcons,
    weatherIconsDay,
    weatherIconsNight,
};

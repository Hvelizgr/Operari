
export const id = 'weather-node';
export const name = 'OpenWeather';
export const description = 'Get current weather data';
export const version = '1.0.0';

export class WeatherNode {
    meta = {
        name: 'OpenWeather',
        version: '1.0.0',
        description: 'Get current weather data',
        author: 'NanoFlow',
        category: 'Services',
        icon: 'cloud'
    };

    async execute(input: any, context: any) {
        context.log('Executing Weather Node...');
        
        const { city, apiKey } = input;
        
        if (!city) {
            throw new Error('City is required');
        }

        if (!apiKey) {
            // Use a mock if no API key is provided
            context.log(`No API key provided for city: ${city}. Returning mock data.`);
            return {
                city,
                weather: 'Cloudy',
                temp: 22.5,
                unit: 'metric',
                mock: true
            };
        }

        const axios = require('axios');
        try {
            const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
                params: {
                    q: city,
                    appid: apiKey,
                    units: 'metric'
                }
            });
            return response.data;
        } catch (error: any) {
            context.log(`Weather node error: ${error.message}`);
            throw new Error(`Failed to fetch weather: ${error.message}`);
        }
    }
}

export const executor = new WeatherNode();

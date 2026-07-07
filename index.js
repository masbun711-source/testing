require('dotenv').config({ quiet: true });
const { Client, GatewayIntentBits } = require('discord.js');
const initializeBot = require('./src/main.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

initializeBot(client);

process.on('unhandledRejection', (reason, promise) => { console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason); });
process.on('uncaughtException', (error) => { console.error('❌ Uncaught Exception:', error); });

client.on('error', error => { console.error('❌ Discord Client Error:', error); });
client.on('warn', warning => { console.warn('⚠️ Discord Client Warning:', warning); });
client.login(process.env.TOKEN);
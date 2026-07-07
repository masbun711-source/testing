const { Collection, Events, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const sticky = require('./models/stickyMessage/function');
const leaderboards = require('./models/leaderboards');

module.exports = async (client) => {
    client.commands = new Collection();
    client.buttons = new Collection();
    client.modals = new Collection();

    const commandsPath = path.join(__dirname, 'commands');

    function loadCommandsRecursively(dir) {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
            const fullPath = path.join(dir, item.name);

            if (item.isDirectory()) {
                loadCommandsRecursively(fullPath);
            } else if (item.isFile() && item.name.endsWith('.js')) {
                try {
                    const command = require(fullPath);
                    if (command && command.data) {
                        client.commands.set(command.data.name, command);
                        console.log(`✅ Loaded command: ${command.data.name}`);
                    }
                } catch (err) {
                    console.error(`❌ Failed to load command ${item.name}:`, err);
                }
            }
        }
    }

    if (fs.existsSync(commandsPath)) {
        loadCommandsRecursively(commandsPath);
    }

    const eventsPath = path.join(__dirname, 'events');
    if (fs.existsSync(eventsPath)) {
        function loadEventsRecursively(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    if (item.name === 'handlers') continue;
                    loadEventsRecursively(fullPath);
                } else if (item.isFile() && item.name.endsWith('.js')) {
                    try {
                        const event = require(fullPath);
                        if (event) {
                            if (event.once) {
                                client.once(event.name, (...args) => event.execute(client, ...args));
                            } else {
                                client.on(event.name, (...args) => event.execute(client, ...args));
                            }
                            // console.log(`✅ Loaded event: ${fullPath}`);
                        }
                    } catch (err) {
                        console.error(`❌ Failed to load event ${fullPath}:`, err);
                    }
                }
            }
        }

        loadEventsRecursively(eventsPath);
    } else {
        console.log(`No events folder found at ${eventsPath}; skipping event registration.`);
    }

    const handlersPath = path.join(eventsPath, 'handlers');
    if (fs.existsSync(handlersPath)) {
        function loadHandlersRecursively(dir) {
            const items = fs.readdirSync(dir, { withFileTypes: true });

            for (const item of items) {
                const fullPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    loadHandlersRecursively(fullPath);
                } else if (item.isFile() && item.name.endsWith('.js')) {
                    try {
                        const handler = require(fullPath);
                        if (handler && handler.name && handler.execute) {
                            if (handler.once) {
                                client.once(handler.name, (...args) => handler.execute(client, ...args));
                            } else {
                                client.on(handler.name, (...args) => handler.execute(client, ...args));
                            }
                            // console.log(`✅ Loaded event handler: ${handler.name}`);
                        }
                    } catch (err) {
                        console.error(`❌ Failed to load handler ${item.name}:`, err);
                    }
                }
            }
        }

        loadHandlersRecursively(handlersPath);
    }

    async function stickyMessage(client, sticky, options = {}) {
        const managedByCategory = new Set();
        try {
            const categoriesDir = path.join(__dirname, 'models', 'stickyMessage', 'category');
            const replacePrevious = options.replacePrevious === false ? false : true;

            if (fs.existsSync(categoriesDir)) {
                const items = fs.readdirSync(categoriesDir, { withFileTypes: true });
                for (const it of items) {
                    if (!it.isDirectory()) continue;
                    const categoryId = it.name;
                    const messageFile = path.join(categoriesDir, categoryId, 'messages.json');
                    if (!fs.existsSync(messageFile)) continue;

                    try {
                        if (typeof sticky.watchCategorySticky === 'function') {
                            await sticky.watchCategorySticky(client, categoryId, { replacePrevious });
                            console.log(`📌 Sticky watcher started for category ${categoryId}`);

                            try {
                                const childs = client.channels.cache.filter(c => c.parentId === categoryId && typeof c.isTextBased === 'function' && c.isTextBased());
                                for (const [chId] of childs) managedByCategory.add(chId);
                            } catch (e) {
                                /* ignore collecting errors */
                            }
                        }
                    } catch (e) {
                        console.error(`❌ Failed to initialize sticky for category ${categoryId}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error initializing sticky messages (categories):', e);
        }

        try {
            const channelsDir = path.join(__dirname, 'models', 'stickyMessage', 'channels');
            const replacePrevious = options.replacePrevious === false ? false : true;

            if (fs.existsSync(channelsDir)) {
                const items = fs.readdirSync(channelsDir, { withFileTypes: true });
                for (const it of items) {
                    if (!it.isDirectory()) continue;
                    const channelId = it.name;
                    if (managedByCategory.has(channelId)) {
                        console.log(`⤴️ Skipping channel ${channelId} because it's managed by a category sticky`);
                        continue;
                    }
                    const messageFile = path.join(channelsDir, channelId, 'message.json');
                    if (!fs.existsSync(messageFile)) continue;

                    try {
                        await sticky.watchChannelSticky(client, channelId, { replacePrevious });
                        console.log(`📌 Sticky watcher started for channel ${channelId}`);
                    } catch (e) {
                        console.error(`❌ Failed to initialize sticky for ${channelId}:`, e);
                    }
                }
            }
        } catch (e) {
            console.error('❌ Error initializing sticky messages (channels):', e);
        }
    }

    client.once(Events.ClientReady, async () => {
        console.log(`✅ Logged in as ${client.user.tag}`);
        console.log('🚀 All systems initialized and ready!');
        try {
            const replacePrevious = process.env.STICKY_REPLACE === 'false' ? false : true;
            try { if (leaderboards && typeof leaderboards.syncFromChannelDb === 'function') leaderboards.syncFromChannelDb(); } catch (e) { /* ignore */ }
            await stickyMessage(client, sticky, { replacePrevious });
            try { if (leaderboards && typeof leaderboards.updateOrPostAll === 'function') await leaderboards.updateOrPostAll(client); } catch (e) { /* ignore */ }
            try { if (leaderboards && typeof leaderboards.updateOrPostMonthly === 'function') await leaderboards.updateOrPostMonthly(client); } catch (e) { /* ignore */ }
        } catch (e) {
            console.error('❌ Error initializing sticky messages:', e);
        }

        const Texts = [
            'Leaderboard',
            'World AMANLVL',
            'admin database',
        ];

        async function setRandomActivity() {
            const types = ['PLAYING', 'WATCHING'];
            const type = types[Math.floor(Math.random() * types.length)];
            let text;
            if (type === 'WATCHING' && Math.random() < 0.25) {
                try {
                    const guild = client.guilds.cache.first();
                    if (guild) {
                        await guild.members.fetch();
                        const totalMembers = guild.members.cache.filter(m => !m.user.bot).size;
                        text = `${totalMembers} members`;
                    } else {
                        text = Texts[Math.floor(Math.random() * Texts.length)];
                    }
                } catch {
                    text = Texts[Math.floor(Math.random() * Texts.length)];
                }
            } else {
                text = Texts[Math.floor(Math.random() * Texts.length)];
            }
            client.user.setActivity(text, { type });
        }
        setRandomActivity();
        setInterval(setRandomActivity, 60 * 1000);

        try {
            await deployCommands(client);
        } catch (e) {
            console.error('❌ Failed to deploy commands on ready:', e);
        }
    });
};

async function deployCommands(client) {
    try {
        const guildId = process.env.GUILD_ID;
        if (!guildId) {
            console.log('No GUILD_ID found in environment; skipping guild command deployment.');
            return;
        }

        const commandsPath = path.join(__dirname, 'commands');
        const guildCommands = [];

        if (fs.existsSync(commandsPath)) {
            function collectAllCommands(dir) {
                const files = [];
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    const fullPath = path.join(dir, item.name);
                    if (item.isDirectory()) files.push(...collectAllCommands(fullPath));
                    else if (item.isFile() && item.name.endsWith('.js')) files.push(fullPath);
                }
                return files;
            }

            const allCommandFiles = collectAllCommands(commandsPath);
            for (const file of allCommandFiles) {
                try {
                    const command = require(path.resolve(file));
                    if (command && 'data' in command && 'execute' in command) {
                        guildCommands.push(command.data.toJSON());
                    }
                } catch (err) {
                    console.error(`❌ Failed to load command ${path.basename(file)}:`, err);
                }
            }
        } else {
            console.log(`No commands folder found at ${commandsPath}; nothing to deploy.`);
        }

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log(`🔄 Deploying ${guildCommands.length} commands to guild ${guildId}...`);

            let existing = [];
            try {
                const fetched = await rest.get(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId));
                existing = Array.isArray(fetched) ? fetched : [];
            } catch (err) {
                console.error('❌ Failed to fetch existing guild commands:', err);
            }

            const desiredNames = guildCommands.map(c => c.name);

            if (guildCommands.length === 0) {
                for (const cmd of existing) {
                    try {
                        await rest.delete(Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId, cmd.id));
                        console.log(`🗑️ Deleted old command: ${cmd.name}`);
                    } catch (delErr) {
                        console.error(`❌ Failed deleting old command ${cmd.name}:`, delErr);
                    }
                }
                console.log(`✅ Deleted ${existing.length} existing guild commands for ${guildId}.`);
            } else {
                const toDelete = existing.filter(cmd => !desiredNames.includes(cmd.name));
                for (const cmd of toDelete) {
                    try {
                        await rest.delete(Routes.applicationGuildCommand(process.env.CLIENT_ID, guildId, cmd.id));
                        console.log(`🗑️ Deleted old command: ${cmd.name}`);
                    } catch (delErr) {
                        console.error(`❌ Failed deleting old command ${cmd.name}:`, delErr);
                    }
                }

                try {
                    const data = await rest.put(
                        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
                        { body: guildCommands },
                    );
                    console.log(`✅ Successfully deployed ${Array.isArray(data) ? data.length : 0} guild commands for ${guildId}.`);
                } catch (putErr) {
                    console.error(`❌ Error deploying commands for guild ${guildId}:`, putErr);
                }
            }
        } catch (error) {
            console.error(`❌ Error deploying commands for guild ${guildId}:`, error);
        }
    } catch (error) {
        console.error('❌ Error refreshing commands:', error);
    }
}
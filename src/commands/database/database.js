const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const leaderboards = require('../../models/leaderboards');

const REQUIRED_ROLE_ID = '1449963608950964287';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('database')
        .setDescription('Database related commands.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(false)
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup
                .setName('manage')
                .setDescription('Manage the database.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('add')
                        .setDescription('Create a private text channel and add the specified user.')
                        .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
                        .addUserOption(o => o.setName('user').setDescription('User to add to channel').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a private channel by name.')
                        .addStringOption(o => o.setName('name').setDescription('Channel name to remove').setRequired(true))
                )
        ),

    async execute(interaction) {
        const member = interaction.member;
        if (!member) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        if (!member.roles || !member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: 'You do not have the required role to use this command.', ephemeral: true });
        }

        const subGroup = interaction.options.getSubcommandGroup(false);
        const sub = interaction.options.getSubcommand(false);

        if (subGroup === 'manage') {
            if (sub === 'add') {
                const channelName = interaction.options.getString('name', true);
                const user = interaction.options.getUser('user', true);

                const guild = interaction.guild;
                if (!guild) return interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });

                try {
                    const channelRealName = `┇${channelName}`;

                    const everyoneRole = guild.roles.everyone;
                    const overwrites = [
                        { id: everyoneRole.id, deny: ['ViewChannel'] },
                        { id: user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] },
                        { id: member.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'] }
                    ];

                    const configPath = path.join(__dirname, '..', '..', '..', 'config.yaml');
                    let CATEGORY_ID = null;
                    try {
                        if (fs.existsSync(configPath)) {
                            const cfg = fs.readFileSync(configPath, 'utf8');
                            const m = cfg.split(/\r?\n/).map(l => l.trim()).find(l => /^Category\s*:/i.test(l));
                            if (m) {
                                CATEGORY_ID = m.split(':').slice(1).join(':').trim();
                            }
                        }
                    } catch (e) {
                        console.error('Failed to read config.yaml for CATEGORY_ID, using default.', e);
                    }

                    let createOptions = {
                        name: channelRealName,
                        type: ChannelType.GuildText,
                        permissionOverwrites: overwrites
                    };
                    const parent = guild.channels.cache.get(CATEGORY_ID);
                    if (parent && parent.type === ChannelType.GuildCategory) {
                        createOptions.parent = CATEGORY_ID;
                    } else {
                        console.warn(`Category ${CATEGORY_ID} not found or not a category. Creating channel at root.`);
                    }

                    const created = await guild.channels.create(createOptions);

                    try {
                        const dbFile = path.join(__dirname, '..', '..', 'database', 'channel.json');
                        let channels = [];
                        if (fs.existsSync(dbFile)) {
                            try { channels = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) { channels = []; }
                        }

                        let userName = user.username;
                        try {
                            const fetched = await guild.members.fetch(user.id);
                            if (fetched) userName = fetched.displayName || fetched.user.username;
                        } catch (e) { }

                        const entry = {
                            channel_id: created.id,
                            channel_name: channelName,
                            user_id: user.id,
                            user_name: userName,
                            pack_1: null,
                            pack_2: null,
                            pack_3: null,
                            pack_4: null,
                            reffund_pack_1: null,
                            reffund_pack_2: null,
                            reffund_pack_3: null,
                            reffund_pack_4: null
                        };

                        channels.push(entry);
                        fs.writeFileSync(dbFile, JSON.stringify(channels, null, 4), 'utf8');

                        try {
                            if (leaderboards && typeof leaderboards.ensureEntryAll === 'function') leaderboards.ensureEntryAll(user.id, created.id);
                            if (leaderboards && typeof leaderboards.ensureEntryMonthly === 'function') leaderboards.ensureEntryMonthly(user.id, created.id);
                        } catch (e) {
                            console.error('Failed to ensure leaderboard entry on database add:', e);
                        }
                    } catch (e) {
                        console.error('Failed to persist channel entry:', e);
                    }

                    return interaction.reply({ content: `Private channel ${created} created and ${user} added.`, ephemeral: true });
                } catch (err) {
                    console.error('Failed to create private channel:', err);
                    return interaction.reply({ content: 'Failed to create channel.', ephemeral: true });
                }
            } else if (sub === 'remove') {
                const channelName = interaction.options.getString('name', true);
                const guild = interaction.guild;
                if (!guild) return interaction.reply({ content: 'This command must be used in a guild.', ephemeral: true });

                const searchName = `┇${channelName}`;
                const channel = guild.channels.cache.find(c => c.name === searchName && c.type === ChannelType.GuildText);
                if (!channel) return interaction.reply({ content: `Channel named ${channelName} not found.`, ephemeral: true });

                try {
                    try {
                        const dbFile = path.join(__dirname, '..', '..', 'database', 'channel.json');
                        let channels = [];
                        if (fs.existsSync(dbFile)) {
                            try { channels = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch (e) { channels = []; }
                        }

                        const filtered = channels.filter(e => e.channel_id !== channel.id);
                        if (filtered.length !== channels.length) {
                            try { fs.writeFileSync(dbFile, JSON.stringify(filtered, null, 4), 'utf8'); } catch (e) { console.error('Failed to update channel.json:', e); }
                        }

                        try {
                            leaderboards.removeByChannel(channel.id);
                        } catch (e) {
                            console.error('Failed to remove leaderboard entries on database remove:', e);
                        }
                    } catch (e) {
                        console.error('Failed to remove channel entry from DB:', e);
                    }

                    try {
                        await interaction.reply({ content: `Channel ${channelName} deleted.`, ephemeral: true });
                    } catch (replyErr) {
                        console.error('Failed to send deletion reply:', replyErr);
                    }

                    setTimeout(async () => {
                        try {
                            await channel.delete();
                        } catch (delErr) {
                            console.error('Failed to delete channel after delay:', delErr);
                        }
                    }, 5000);

                    return;
                } catch (err) {
                    console.error('Failed to delete channel:', err);
                    return interaction.reply({ content: 'Failed to delete channel.', ephemeral: true });
                }
            }
        }

        return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
    }
}
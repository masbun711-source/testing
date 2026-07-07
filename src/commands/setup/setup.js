const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Sets up the bot in the server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show the setup options.'))
        .addSubcommandGroup(subcommandGroup =>
            subcommandGroup
                .setName('packs')
                .setDescription('Setup packs for the server.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('pack-1')
                        .setDescription('Setup Pack 1')
                        .addStringOption(o => o.setName('name').setDescription('Pack name').setRequired(true))
                        .addIntegerOption(o => o.setName('xp').setDescription('XP amount').setRequired(true))
                        .addNumberOption(o => o.setName('price').setDescription('Price').setRequired(true))
                        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
                        .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('pack-2')
                        .setDescription('Setup Pack 2')
                        .addStringOption(o => o.setName('name').setDescription('Pack name').setRequired(true))
                        .addIntegerOption(o => o.setName('xp').setDescription('XP amount').setRequired(true))
                        .addNumberOption(o => o.setName('price').setDescription('Price').setRequired(true))
                        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
                        .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('pack-3')
                        .setDescription('Setup Pack 3')
                        .addStringOption(o => o.setName('name').setDescription('Pack name').setRequired(true))
                        .addIntegerOption(o => o.setName('xp').setDescription('XP amount').setRequired(true))
                        .addNumberOption(o => o.setName('price').setDescription('Price').setRequired(true))
                        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
                        .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('pack-4')
                        .setDescription('Setup Pack 4')
                        .addStringOption(o => o.setName('name').setDescription('Pack name').setRequired(true))
                        .addIntegerOption(o => o.setName('xp').setDescription('XP amount').setRequired(true))
                        .addNumberOption(o => o.setName('price').setDescription('Price').setRequired(true))
                        .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes').setRequired(true))
                        .addStringOption(o => o.setName('emoji').setDescription('Emoji'))
                )
        ),
    async execute(interaction) {
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'show') {
            try {
                const dbPath = path.join(__dirname, '..', '..', 'database', 'packs.json');
                if (!fs.existsSync(dbPath)) {
                    return await interaction.reply({ content: 'No packs database found. Nothing is set up yet.', ephemeral: true });
                }

                const raw = fs.readFileSync(dbPath, 'utf8');
                let packs = [];
                try {
                    packs = JSON.parse(raw);
                } catch (err) {
                    return await interaction.reply({ content: 'Packs database is invalid JSON.', ephemeral: true });
                }

                const lines = [];
                for (const item of packs) {
                    const key = Object.keys(item)[0];
                    const p = item[key];
                    const configured = p && p.name && p.name.trim() !== '' && p.xp && p.price;
                    if (configured) {
                        lines.push(`**${key}**: Configured — name: ${p.name}, xp: ${p.xp}, price: ${p.price}`);
                    } else {
                        lines.push(`**${key}**: Not configured`);
                    }
                }

                const reply = lines.join('\n');
                return await interaction.reply({ content: `Pack setup status:\n${reply}`, ephemeral: true });
            } catch (err) {
                console.error('Error reading packs.json:', err);
                try {
                    return await interaction.reply({ content: 'Failed to read packs configuration.', ephemeral: true });
                } catch (e) {
                    console.error('Failed to reply to interaction:', e);
                }
            }
        }

        if (subcommandGroup === 'packs') {
            const packKey = subcommand.replace('-', '_');
            if (!['pack_1', 'pack_2', 'pack_3', 'pack_4'].includes(packKey)) {
                return await interaction.reply({ content: 'Unknown pack.', ephemeral: true });
            }

            try {
                const dbPath = path.join(__dirname, '..', '..', 'database', 'packs.json');
                let packs = [];
                if (fs.existsSync(dbPath)) {
                    try { packs = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { packs = []; }
                }

                let idx = packs.findIndex(item => Object.keys(item)[0] === packKey);
                if (idx === -1) {
                    const obj = {};
                    obj[packKey] = { name: '', xp: null, price: null, duration: null, emoji: '' };
                    packs.push(obj);
                    idx = packs.length - 1;
                }

                const current = packs[idx][packKey];

                const name = interaction.options.getString('name');
                const xp = interaction.options.getInteger('xp');
                const price = interaction.options.getNumber('price');
                const duration = interaction.options.getInteger('duration');
                const emoji = interaction.options.getString('emoji');

                if (name !== null && name !== undefined) current.name = name;
                if (xp !== null && xp !== undefined) current.xp = xp;
                if (price !== null && price !== undefined) current.price = price;
                if (duration !== null && duration !== undefined) current.duration = duration;
                if (emoji !== null && emoji !== undefined) current.emoji = emoji;

                fs.writeFileSync(dbPath, JSON.stringify(packs, null, 4), 'utf8');

                return await interaction.reply({ content: `Updated ${packKey} configuration.`, ephemeral: true });
            } catch (err) {
                console.error('Error updating pack config:', err);
                try { return await interaction.reply({ content: 'Failed to update pack configuration.', ephemeral: true }); } catch (e) { console.error(e); }
            }
        }
    }
}
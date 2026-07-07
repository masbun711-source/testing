const { SlashCommandBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags, SeparatorBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const finance = require('../../utils/finance');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('show')
        .setDescription('Show the Sales on this Channel'),
    async execute(interaction) {
        try {
            const configPath = path.join(__dirname, '..', '..', '..', 'config.yaml');
            let CATEGORY_ID = null;
            try {
                if (fs.existsSync(configPath)) {
                    const cfg = fs.readFileSync(configPath, 'utf8');
                    const m = cfg.split(/\r?\n/).map(l => l.trim()).find(l => /^Category\s*:/i.test(l));
                    if (m) CATEGORY_ID = m.split(':').slice(1).join(':').trim();
                }
            } catch (e) {
                console.error('Failed to read config.yaml for show command:', e);
            }

            if (!CATEGORY_ID) {
                await interaction.reply({ content: 'Category not configured on the bot. Please check config.yaml.', ephemeral: true });
                return;
            }

            const channel = interaction.channel;
            if (!channel || channel.parentId !== CATEGORY_ID) {
                await interaction.reply({ content: 'This command can only be used inside the configured category.', ephemeral: true });
                return;
            }

            const channelCandidates = [
                path.join(__dirname, '..', '..', '..', 'database', 'channel.json'),
                path.join(__dirname, '..', '..', '..', 'src', 'database', 'channel.json'),
            ];
            let channelDb = null;
            for (const p of channelCandidates) {
                try {
                    if (fs.existsSync(p)) { channelDb = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
                } catch (e) { /* ignore and try next */ }
            }

            if (!Array.isArray(channelDb)) channelDb = [];

            const chanEntry = channelDb.find(c => String(c.channel_id) === String(channel.id));
            if (!chanEntry) {
                await interaction.reply({ content: 'Channel not found in database (channel.json).', ephemeral: true });
                return;
            }

            const packsCandidates = [
                path.join(__dirname, '..', '..', '..', 'database', 'packs.json'),
                path.join(__dirname, '..', '..', '..', 'src', 'database', 'packs.json'),
            ];
            let packs = [];
            for (const p of packsCandidates) {
                try { if (fs.existsSync(p)) { packs = JSON.parse(fs.readFileSync(p, 'utf8')); break; } } catch (e) { /* ignore */ }
            }

            const getPack = (key) => {
                for (const p of packs) {
                    if (p && Object.prototype.hasOwnProperty.call(p, key)) return p[key];
                }
                return null;
            };

            const packKeys = ['pack_1', 'pack_2', 'pack_3', 'pack_4'];
            const lines = packKeys.map((k, i) => {
                const data = getPack(k) || {};
                const label = data.name && data.name.length ? data.name : `Pack ${i + 1}`;
                const count = (chanEntry && Object.prototype.hasOwnProperty.call(chanEntry, k) && typeof chanEntry[k] === 'number') ? chanEntry[k] : 0;
                return `${label}: ${count}`;
            });

            const guildIconUrl = interaction.guild?.iconURL ? (interaction.guild.iconURL({ size: 512, extension: 'png' }) || null) : null;
            const fin = finance.calculateCleanVending(chanEntry, packs, packKeys);
            const { seedTotal, profitTotal, refundTotal } = fin;
            const titleSection = new SectionBuilder();
            if (guildIconUrl) titleSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIconUrl));
            titleSection.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# Sales Channel on ${interaction.channel.name}`
                +`\n` + lines.join('\n')
            ));

            const footerLines = [
                `Pack clean profit: ${finance.formatNumber(profitTotal)}`,
                `Seed total: ${finance.formatSeedJarWithEmoji(seedTotal, 'seed')}`,
                `Refund total: ${finance.formatNumber(refundTotal)}`,
                `\nTotal clean + vending: ${finance.breakdownPriceWithEmoji(profitTotal)}, ${finance.formatSeedJarWithEmoji(seedTotal, 'seed')}`
            ];

            const footerSection = new TextDisplayBuilder().setContent(footerLines.join('\n'));

            const message = new ContainerBuilder()
                .addSectionComponents(titleSection)
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1))
                .addTextDisplayComponents(footerSection);

            await interaction.reply({ content: '', components: [message], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('Error in /show command:', err);
            try { await interaction.reply({ content: 'An error occurred while fetching data.', ephemeral: true }); } catch { }
        }
    }
}
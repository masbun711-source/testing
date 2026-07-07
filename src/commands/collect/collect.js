const { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, SectionBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const finance = require('../../utils/finance');
const leaderboards = require('../../models/leaderboards');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('collect')
        .setDescription('Collect profit from this channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const channelCandidates = [
                path.join(__dirname, '..', '..', '..', 'database', 'channel.json'),
                path.join(__dirname, '..', '..', '..', 'src', 'database', 'channel.json'),
            ];
            let channelDbPath = null;
            let channelDb = null;
            for (const p of channelCandidates) {
                try {
                    if (fs.existsSync(p)) { channelDbPath = p; channelDb = JSON.parse(fs.readFileSync(p, 'utf8')); break; }
                } catch (e) { }
            }

            if (!channelDbPath || !Array.isArray(channelDb)) {
                await interaction.reply({ content: 'channel.json not found or invalid.', ephemeral: true });
                return;
            }

            const chanId = interaction.channel?.id;
            const idx = channelDb.findIndex(c => String(c.channel_id) === String(chanId));
            if (idx === -1) {
                await interaction.reply({ content: 'Channel not found in database (channel.json).', ephemeral: true });
                return;
            }

            const entry = channelDb[idx];

            const packsCandidates = [
                path.join(__dirname, '..', '..', '..', 'database', 'packs.json'),
                path.join(__dirname, '..', '..', '..', 'src', 'database', 'packs.json'),
            ];
            let packs = [];
            for (const p of packsCandidates) {
                try { if (fs.existsSync(p)) { packs = JSON.parse(fs.readFileSync(p, 'utf8')); break; } } catch (e) { /* ignore */ }
            }

            const packKeys = ['pack_1','pack_2','pack_3','pack_4'];
            const fin = finance.calculateCleanVending(entry, packs, packKeys);
            const { seedTotal, profitTotal, refundTotal } = fin;

            const titleSection = new TextDisplayBuilder().setContent('# Collected summary');

            const packLines = [];
            for (let i = 0; i < packKeys.length; i++) {
                const k = packKeys[i];
                const count = Number(entry[k] || 0);
                const packEntry = packs.find(p => p && Object.prototype.hasOwnProperty.call(p, k)) || null;
                const packSpec = packEntry ? packEntry[k] : null;
                const profitPerUnit = packEntry && Object.prototype.hasOwnProperty.call(packEntry, 'profit') ? (packEntry.profit == null ? null : Number(packEntry.profit)) : null;
                const pricePerUnit = packSpec && Object.prototype.hasOwnProperty.call(packSpec, 'price') ? (packSpec.price == null ? null : Number(packSpec.price)) : null;

                const name = (packSpec && packSpec.name) || `Pack ${i + 1}`;
                if (count <= 0) {
                    packLines.push(`${name}: 0`);
                    continue;
                }

                const profitSubtotal = profitPerUnit ? profitPerUnit * count : 0;
                const vendingSubtotal = pricePerUnit ? pricePerUnit * count : 0;

                packLines.push(`${name}: ${count} × profit ${finance.formatNumber(profitPerUnit)} = ${finance.formatNumber(profitSubtotal)} | vending ${finance.formatNumber(pricePerUnit)} = ${finance.formatNumber(vendingSubtotal)}`);
            }

            const detailLines = [
                `Pack breakdown:\n${packLines.join('\n')}`,
                `Pack clean profit: ${finance.formatNumber(profitTotal)}`,
                `Seed total: ${finance.formatSeedJarWithEmoji(seedTotal, 'seed')}`,
                `Refund total: ${finance.formatNumber(refundTotal)}`,
                `\nTotal clean + vending: ${finance.breakdownPriceWithEmoji(profitTotal)}, ${finance.formatSeedJarWithEmoji(seedTotal, 'seed')}`
            ];

            const footerSection = new TextDisplayBuilder().setContent(detailLines.join('\n'));

            const message = new ContainerBuilder()
                .addTextDisplayComponents(titleSection)
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1))
                .addTextDisplayComponents(footerSection);

            await interaction.reply({ content: '', components: [message], flags: MessageFlags.IsComponentsV2 });

            try {
                const userId = entry.user_id || interaction.user.id;
                const channelId = entry.channel_id || interaction.channelId || interaction.channel?.id;
                await leaderboards.addCollectedAll(userId, channelId, profitTotal, seedTotal);
                await leaderboards.addCollectedMonthly(userId, channelId, profitTotal, seedTotal);
            } catch (e) {
                console.error('Failed to update leaderboards from /collect:', e);
            }

            for (const k of packKeys) {
                if (Object.prototype.hasOwnProperty.call(entry, k)) entry[k] = null;
                const refundKey = `reffund_${k}`;
                if (Object.prototype.hasOwnProperty.call(entry, refundKey)) entry[refundKey] = null;
            }

            try {
                fs.writeFileSync(channelDbPath, JSON.stringify(channelDb, null, 2));
            } catch (e) {
                console.error('Failed to write channel.json after collect:', e);
                return;
            }

        } catch (err) {
            console.error('Error in /collect command:', err);
            try { await interaction.reply({ content: 'An error occurred while collecting.', ephemeral: true }); } catch {}
        }
    }
}
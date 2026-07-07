const { ContainerBuilder, MessageFlags, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js')
const fs = require('fs');
const path = require('path');
const calc = require('../../../events/calculator/calculator.js');

module.exports = {
    customId: 'modal_pack_1',
    async execute(interaction) {
        try {
            if (!interaction.isModalSubmit?.()) return;

            const start_level = interaction.fields.getTextInputValue('start_level');
            const start_xp = interaction.fields.getTextInputValue('start_xp');
            const end_level = interaction.fields.getTextInputValue('end_level');
            const end_xp = interaction.fields.getTextInputValue('end_xp');

            const errors = [];
            if (!/^[0-9]+$/.test(start_level)) errors.push('`start_level` must be an integer.');
            if (!/^[0-9]+$/.test(start_xp)) errors.push('`start_xp` must be an integer.');
            if (!/^[0-9]+$/.test(end_level)) errors.push('`end_level` must be an integer.');
            if (!/^[0-9]+$/.test(end_xp)) errors.push('`end_xp` must be an integer.');

            if (errors.length) {
                await interaction.reply({ content: `Validation errors:\n${errors.join('\n')}`, ephemeral: true });
                return;
            }

            const submission = {
                userId: interaction.user.id,
                timestamp: new Date().toISOString(),
                pack: 'pack_1',
                start_level: Number(start_level),
                start_xp: Number(start_xp),
                end_level: Number(end_level),
                end_xp: Number(end_xp),
            };

            const channelDbPath = path.join(__dirname, '..', '..', '..', 'database', 'channel.json');
            try {
                let channels = [];
                if (fs.existsSync(channelDbPath)) {
                    const raw = fs.readFileSync(channelDbPath, 'utf8');
                    channels = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
                }

                const chanId = interaction.channel?.id;
                let idx = channels.findIndex(c => c.channel_id === String(chanId));
                if (idx === -1) idx = channels.findIndex(c => c.user_id === String(interaction.user?.id));

                if (idx !== -1) {
                    const current = channels[idx].pack_1;
                    if (typeof current === 'number') {
                        channels[idx].pack_1 = current + 1;
                    } else {
                        channels[idx].pack_1 = 1;
                    }
                } else {
                    const newEntry = {
                        channel_id: chanId ? String(chanId) : null,
                        channel_name: interaction.channel?.name || null,
                        user_id: interaction.user?.id || null,
                        user_name: interaction.user?.username || null,
                        pack_1: 1,
                    };
                    channels.push(newEntry);
                }

                fs.writeFileSync(channelDbPath, JSON.stringify(channels, null, 2));
            } catch (e) {
                console.error('Failed to persist pack submission into channel.json:', e);
            }

            try {
                const rawId = interaction.customId || '';
                const maybeMessageId = rawId.includes(':') ? rawId.split(':').slice(1).join(':') : null;
                if (maybeMessageId && interaction.channel) {
                    const orig = await interaction.channel.messages.fetch(maybeMessageId).catch(() => null);
                    if (orig && orig.edit) {
                        const xpGained = calc.calculateXpBetween(Number(start_level), Number(start_xp), Number(end_level), Number(end_xp));
                        const xpStr = calc.formatCleanValue(xpGained);

                        const packsPath = path.join(__dirname, '..', '..', '..', 'database', 'packs.json');
                        let packXp = 0;
                        let packName = 'Pack 1';
                        try {
                            if (fs.existsSync(packsPath)) {
                                const rawP = fs.readFileSync(packsPath, 'utf8');
                                const packs = JSON.parse(rawP);
                                const packEntry = (packs && packs.find && packs.find(x => x && (x.pack_1 || x['pack_1']))) || null;
                                const maybe = packEntry ? (packEntry.pack_1 || packEntry['pack_1']) : null;
                                if (maybe) {
                                    packXp = Number(maybe.xp) || 0;
                                    packName = maybe.name || packName;
                                }
                            }
                        } catch (pe) {
                            console.error('Failed to read packs.json for thumbnail logic:', pe);
                        }

                        const diff = Number(xpGained) - Number(packXp || 0);
                        const diffSign = diff >= 0 ? '+' : '-';
                        const diffAbsStr = calc.formatCleanValue(Math.abs(diff));

                        const guildIconUrl = interaction.guild?.iconURL ? (interaction.guild.iconURL({ size: 512, extension: 'png' }) || null) : null;
                        const sectionMain = new SectionBuilder();
                        if (guildIconUrl) sectionMain.setThumbnailAccessory(new ThumbnailBuilder().setURL(guildIconUrl));
                        const mainText = String(
                            `### ✅ ${packName} submission received from <@${interaction.user.id}>!\n` +
                            `• Start Level: ${start_level}\n` +
                            `• Start XP: ${start_xp}\n` +
                            `• End Level: ${end_level}\n` +
                            `• End XP: ${end_xp}\n\n` +
                            `• XP Gained: ${xpStr} (${diffSign}${diffAbsStr} compared to pack XP of ${packXp})`
                        );
                        sectionMain.addTextDisplayComponents(new TextDisplayBuilder().setContent(mainText));

                        const message = new ContainerBuilder()
                            .addSectionComponents(sectionMain)
                            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(1));

                        const editPayload = { content: '', components: [message], flags: MessageFlags.IsComponentsV2 };

                        await orig.edit(editPayload).catch((err) => { console.error('edit error:', err); });
                    }
                }
            } catch (e) {
                console.error('Failed to fetch/edit original message for pack_1 modal:', e);
            }
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferReply({ ephemeral: true });
                    setTimeout(async () => {
                        try {
                            await interaction.deleteReply();
                        } catch (delErr) { }
                    }, 250);
                }
            } catch (e) {
                console.error('Failed to defer/delete ephemeral reply for modal_pack_1:', e);
            }
        } catch (err) {
            console.error('Error handling modal_pack_1 submit:', err);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while processing your submission.', ephemeral: true });
                }
            } catch (e) {
                console.error('Failed to send error reply for modal_pack_1:', e);
            }
        }
    },
};

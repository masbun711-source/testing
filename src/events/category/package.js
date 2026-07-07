const { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.MessageCreate,
    async execute(client, message) {
        try {
            if (message.author?.bot) return;

            const successEmojis = ['📦', '🎉', '✅', '📸', '✨', '👍', '🔥', '🥳', '🏆', '👏'];
            const failEmojis = ['⚠️', '❌', '📛', '🙁', '🔻', '❗', '😕', '😞', '🚫', '👎'];

            const configPath = path.join(__dirname, '..', '..', '..', 'config.yaml');
            let CATEGORY_ID = null;
            try {
                if (fs.existsSync(configPath)) {
                    const cfg = fs.readFileSync(configPath, 'utf8');
                    const m = cfg.split(/\r?\n/).map(l => l.trim()).find(l => /^Category\s*:/i.test(l));
                    if (m) CATEGORY_ID = m.split(':').slice(1).join(':').trim();
                }
            } catch (e) {
                console.error('Failed to read config.yaml for package event:', e);
            }

            if (!CATEGORY_ID) return;

            const channel = message.channel;
            if (!channel || channel.parentId !== CATEGORY_ID) return;

            let imageCount = 0;
            for (const attachment of message.attachments.values()) {
                const contentType = attachment.contentType || '';
                const name = attachment.name || '';
                if (contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(name)) {
                    imageCount++;
                }
            }

            if (imageCount === 0) return;

            const pool = imageCount >= 3 ? successEmojis : failEmojis;
            const randomEmoji = pool[Math.floor(Math.random() * pool.length)];
            try {
                await message.react(randomEmoji);
            } catch (e) {
                console.error('Failed to react to message in package handler:', e);
            }

            try {
                const packsPath = path.join(__dirname, '..', '..', '..', 'src', 'database', 'packs.json');
                let packs = [];
                try {
                    if (fs.existsSync(packsPath)) {
                        const raw = fs.readFileSync(packsPath, 'utf8');
                        packs = JSON.parse(raw);
                    }
                } catch (pe) {
                    console.error('Failed to read packs.json for package handler:', pe);
                }

                const getPack = (key) => {
                    for (const p of packs) {
                        if (p && Object.prototype.hasOwnProperty.call(p, key)) return p[key];
                    }
                    return null;
                };

                const packKeys = ['pack_1', 'pack_2', 'pack_3', 'pack_4'];
                const packButtons = packKeys.map((k, i) => {
                    const data = getPack(k) || {};
                    const label = data.name && data.name.length ? data.name : `Pack ${i + 1}`;
                    const btn = new ButtonBuilder()
                        .setCustomId(k)
                        .setLabel(label)
                        .setStyle(ButtonStyle.Secondary);
                    if (data.emoji) btn.setEmoji(data.emoji);
                    if (!data.name) btn.setDisabled(true);
                    return btn;
                });

                const row1 = new ActionRowBuilder().addComponents(packButtons);

                const refundBtn = new ButtonBuilder()
                    .setCustomId('reffund_pack')
                    .setLabel('Refund Pack')
                    .setStyle(ButtonStyle.Danger);
                const row2 = new ActionRowBuilder().addComponents(refundBtn);

                if (imageCount >= 3) {
                    await message.reply({
                        content: 'Thank you — enough photos provided.',
                        components: [row1, row2],
                    });
                } else {
                    await message.reply({
                        content: 'Not enough photos — please provide at least 3 images.'
                    });
                }
            } catch (e) {
                console.error('Failed to reply in package handler:', e);
            }
        } catch (err) {
            console.error('Error in package message handler:', err);
        }
    }
};

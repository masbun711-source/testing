const fs = require('fs');
const path = require('path');

/**
 * Modal handler for `update_modal`.
 * Attempts to determine the pack key and new value from the modal submission,
 * then overwrites that pack count in the channel database for the current channel.
 */
module.exports = {
    async execute(interaction) {
        try {
            let packKey = null;
            let newValueRaw = null;

            try {
                const cid = interaction.customId || '';
                const m = String(cid).match(/^update_modal:(pack_[1-4])$/i);
                if (m) packKey = m[1].toLowerCase();
            } catch (e) { /* ignore */ }

            try {
                if (!packKey && typeof interaction.fields.getStringSelectValues === 'function') {
                    const vals = interaction.fields.getStringSelectValues('select_pack_to_update');
                    if (Array.isArray(vals) && vals.length) packKey = String(vals[0]).toLowerCase();
                }
            } catch (e) { /* ignore */ }

            try { if (!packKey) packKey = interaction.fields.getTextInputValue && interaction.fields.getTextInputValue('pack_key'); } catch (e) { /* ignore */ }

            try { newValueRaw = interaction.fields.getTextInputValue('new_pack_value'); } catch (e) { /* ignore */ }

            if (!packKey && newValueRaw) {
                const m = String(newValueRaw).match(/(pack_[1-4])\s*[:=]\s*(null|\d+)/i);
                if (m) {
                    packKey = m[1].toLowerCase();
                    newValueRaw = m[2];
                }
            }

            if (!packKey) {
                try {
                    const raw = interaction?.components || interaction?.data?.components;
                    const findValue = (arr) => {
                        for (const row of arr) {
                            const comps = row.components || row;
                            for (const c of comps) {
                                const value = c.value || c.values || c[0]?.value;
                                if (value) return Array.isArray(value) ? value[0] : value;
                            }
                        }
                        return null;
                    };
                    const detected = findValue(raw || []);
                    if (detected && /(pack_[1-4])/i.test(detected)) packKey = detected.toLowerCase();
                } catch (e) { /* ignore */ }
            }

            if (!newValueRaw) {
                await interaction.reply({ content: 'Could not read the new value from the modal.', ephemeral: true });
                return;
            }

            let newValue = null;
            if (String(newValueRaw).trim().toLowerCase() === 'null') {
                newValue = null;
            } else {
                const n = Number(String(newValueRaw).trim());
                if (Number.isNaN(n)) {
                    await interaction.reply({ content: 'New value must be a number or the word `null`.', ephemeral: true });
                    return;
                }
                newValue = n;
            }

            if (!packKey || !/^pack_[1-4]$/.test(packKey)) {
                await interaction.reply({ content: 'Pack key not provided or invalid. Use pack_1..pack_4.', ephemeral: true });
                return;
            }

            const candidates = [
                path.join(__dirname, '..', '..', '..', 'database', 'channel.json'),
                path.join(__dirname, '..', '..', '..', 'src', 'database', 'channel.json'),
            ];

            let dbPath = null;
            let db = null;
            for (const p of candidates) {
                try {
                    if (fs.existsSync(p)) {
                        dbPath = p;
                        db = JSON.parse(fs.readFileSync(p, 'utf8'));
                        break;
                    }
                } catch (e) { /* ignore and try next */ }
            }

            if (!dbPath || !Array.isArray(db)) {
                await interaction.reply({ content: 'Channel database not found or invalid.', ephemeral: true });
                return;
            }

            const chanId = interaction.channel?.id;
            if (!chanId) {
                await interaction.reply({ content: 'Could not determine channel id for this interaction.', ephemeral: true });
                return;
            }

            const idx = db.findIndex(e => String(e.channel_id) === String(chanId));
            if (idx === -1) {
                await interaction.reply({ content: 'This channel is not registered in the database.', ephemeral: true });
                return;
            }

            const entry = db[idx];
            entry[packKey] = newValue;

            try {
                fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
            } catch (e) {
                console.error('Failed to write channel.json in update_modal handler:', e);
                await interaction.reply({ content: 'Failed to update database file.', ephemeral: true });
                return;
            }

            await interaction.reply({ content: `Updated ${packKey} for this channel to ${newValue === null ? 'null' : newValue}.`, ephemeral: true });
        } catch (err) {
            console.error('Error in update_modal handler:', err);
            try { await interaction.reply({ content: 'An unexpected error occurred processing the update.', ephemeral: true }); } catch {};
        }
    }
};

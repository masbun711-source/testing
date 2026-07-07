const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    execute: async (client, interaction) => {
        try {
            if (!interaction || !interaction.isStringSelectMenu || !interaction.isStringSelectMenu()) return;
            const id = interaction.customId;

            const specific = path.join(__dirname, `${id}.js`);
            if (fs.existsSync(specific)) {
                const handler = require(specific);
                if (handler && typeof handler.execute === 'function') return handler.execute(client, interaction);
            }

        } catch (err) {
            console.error('Error in selectMenuHandler:', err);
            try {
                if (interaction && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while handling the select menu.', ephemeral: true });
                }
            } catch (replyErr) {
                console.error('Failed to send error reply in selectMenuHandler:', replyErr);
            }
        }
    }
};

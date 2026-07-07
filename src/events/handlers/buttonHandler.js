const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(client, interaction) {
        try {
            if (!interaction || !interaction.isButton || !interaction.isButton()) return;
            const id = interaction.customId;

            const cmd = client.commands.get(id);
            if (cmd && typeof cmd.execute === 'function') {
                return cmd.execute(interaction);
            }

            try {
                const modelButtonPath = path.join(__dirname, '..', '..', 'models', 'packages', 'buttons', `${id}.js`);
                if (fs.existsSync(modelButtonPath)) {
                    try {
                        delete require.cache[require.resolve(modelButtonPath)];
                        const modelHandler = require(modelButtonPath);
                        if (modelHandler && typeof modelHandler.execute === 'function') return await modelHandler.execute(interaction);
                    } catch (e) {
                        console.error(`Error executing model button handler for ${id}:`, e);
                        try { await interaction.reply({ content: '❌ An error occurred while processing this button!', ephemeral: true }); } catch {};
                        return;
                    }
                }
            } catch (e) {
                console.error(`Error loading model button handler for ${id}:`, e);
            }

            const specific = path.join(__dirname, `${id}.js`);
            if (fs.existsSync(specific)) {
                try {
                    delete require.cache[require.resolve(specific)];
                    const handler = require(specific);
                    if (handler && typeof handler.execute === 'function') return await handler.execute(client, interaction);
                } catch (e) {
                    console.error(`Error executing handler ${specific}:`, e);
                    try { await interaction.reply({ content: '❌ An error occurred while processing this button!', ephemeral: true }); } catch {};
                    return;
                }
            }

        } catch (err) {
            console.error('Error in buttonHandler:', err);
            try {
                if (interaction && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while handling the button.', ephemeral: true });
                }
            } catch (replyErr) {
                console.error('Failed to send error reply in buttonHandler:', replyErr);
            }
        }
    }
};

const path = require('path');
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    execute: async (client, interaction) => {
        try {
            if (!interaction || !interaction.isChatInputCommand || !interaction.isChatInputCommand()) return;
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            if (typeof command.execute === 'function') {
                await command.execute(interaction);
            }
        } catch (err) {
            console.error('Error in slashCommandHandler:', err);
            try {
                if (interaction && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
                }
            } catch (replyErr) {
                console.error('Failed to send error reply in slashCommandHandler:', replyErr);
            }
        }
    }
};

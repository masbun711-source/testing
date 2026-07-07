const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(client, interaction) {
        try {
            if (!interaction || !interaction.isModalSubmit || !interaction.isModalSubmit()) return;
            const id = interaction.customId;

            try {
                let modelId;
                if (id.startsWith('modal_')) {
                    const rest = id.slice('modal_'.length);
                    modelId = rest.split(':')[0];
                } else {
                    modelId = id.split(':')[0];
                }
                const modelModalPath = path.join(__dirname, '..', '..', 'models', 'packages', 'modals', `${modelId}.js`);
                const exists = fs.existsSync(modelModalPath);
                if (exists) {
                    try {
                        delete require.cache[require.resolve(modelModalPath)];
                        const modelHandler = require(modelModalPath);
                        if (modelHandler && typeof modelHandler.execute === 'function') return await modelHandler.execute(interaction);
                    } catch (e) {
                        console.error(`Error executing model modal handler for ${id}:`, e);
                        try { await interaction.reply({ content: '❌ An error occurred while processing this modal!', ephemeral: true }); } catch {};
                        return;
                    }
                }
            } catch (e) {
                console.error(`Error loading model modal handler for ${id}:`, e);
            }

            for (const cmd of client.commands.values()) {
                if (typeof cmd.handleModal === 'function') {
                    try {
                        await Promise.resolve(cmd.handleModal(interaction)).catch(err => {
                            console.error('[modalHandler] command.handleModal rejected:', err);
                        });
                    } catch (e) {
                        console.error('[modalHandler] error while running command.handleModal:', e);
                    }
                }
            }

            const specific = path.join(__dirname, `${id}.js`);
            if (fs.existsSync(specific)) {
                try {
                    delete require.cache[require.resolve(specific)];
                    const handler = require(specific);
                    if (handler && typeof handler.execute === 'function') return await handler.execute(client, interaction);
                } catch (e) {
                    console.error(`Error executing handler ${specific}:`, e);
                    try { await interaction.reply({ content: '❌ An error occurred while processing this modal!', ephemeral: true }); } catch {};
                    return;
                }
            }
        } catch (err) {
            console.error('Error in modalHandler:', err);
            try {
                if (interaction && !interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An error occurred while processing the modal.', ephemeral: true });
                }
            } catch (replyErr) {
                console.error('Failed to send error reply in modalHandler:', replyErr);
            }
        }
    }
};

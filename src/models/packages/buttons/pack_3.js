const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'pack_3',
    async execute(interaction) {
        try {
            if (!interaction.isButton?.()) return;
            const msgId = interaction.message?.id;
            const modal = new ModalBuilder()
                .setCustomId(`modal_pack_3:${msgId || 'unknown'}`)
                .setTitle('Pack 3 Submission');

            const startLevel = new TextInputBuilder()
                .setCustomId('start_level')
                .setLabel('Start Level')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const startXp = new TextInputBuilder()
                .setCustomId('start_xp')
                .setLabel('Start XP')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const endLevel = new TextInputBuilder()
                .setCustomId('end_level')
                .setLabel('End Level')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const endXp = new TextInputBuilder()
                .setCustomId('end_xp')
                .setLabel('End XP')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(startLevel),
                new ActionRowBuilder().addComponents(startXp),
                new ActionRowBuilder().addComponents(endLevel),
                new ActionRowBuilder().addComponents(endXp),
            );

            await interaction.showModal(modal);
        } catch (err) {
            console.error('Error showing pack_3 modal:', err);
            try { await interaction.reply({ content: '❌ Error opening modal.', ephemeral: true }); } catch {};
        }
    },
};

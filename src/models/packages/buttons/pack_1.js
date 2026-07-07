const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    customId: 'pack_1',
    async execute(interaction) {
        try {
            if (!interaction.isButton?.()) return;

            const msgId = interaction.message?.id;
            console.log('[pack_1 button] clicked by', interaction.user?.id, 'messageId=', msgId);
            const modal = new ModalBuilder()
                .setCustomId(`modal_pack_1:${msgId || 'unknown'}`)
                .setTitle('Pack 1 Submission');

            const startLevel = new TextInputBuilder()
                .setCustomId('start_level')
                .setLabel('Start Level')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 1')
                .setRequired(true);

            const startXp = new TextInputBuilder()
                .setCustomId('start_xp')
                .setLabel('Start XP')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 0')
                .setRequired(true);

            const endLevel = new TextInputBuilder()
                .setCustomId('end_level')
                .setLabel('End Level')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 10')
                .setRequired(true);

            const endXp = new TextInputBuilder()
                .setCustomId('end_xp')
                .setLabel('End XP')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 125000')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(startLevel),
                new ActionRowBuilder().addComponents(startXp),
                new ActionRowBuilder().addComponents(endLevel),
                new ActionRowBuilder().addComponents(endXp),
            );

            await interaction.showModal(modal);
            console.log('[pack_1 button] showModal called for user', interaction.user?.id);
        } catch (err) {
            console.error('Error showing pack_1 modal:', err);
            try { await interaction.reply({ content: '❌ An error occurred while opening the modal.', ephemeral: true }); } catch { };
        }
    },
};

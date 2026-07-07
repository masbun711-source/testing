const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, LabelBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('update')
        .setDescription('Update the Sales on this Channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const selectLabel = new LabelBuilder()
                .setLabel('Select Pack')
                .setDescription('Choose which pack to update')
                .setStringSelectMenuComponent(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_pack_to_update')
                        .setPlaceholder('Select a pack to update')
                        .addOptions(
                            new StringSelectMenuOptionBuilder().setLabel('Pack 1').setValue('pack_1'),
                            new StringSelectMenuOptionBuilder().setLabel('Pack 2').setValue('pack_2'),
                            new StringSelectMenuOptionBuilder().setLabel('Pack 3').setValue('pack_3'),
                            new StringSelectMenuOptionBuilder().setLabel('Pack 4').setValue('pack_4')
                        )
                );

            const inputLabel = new LabelBuilder()
                .setLabel('New Value')
                .setDescription('Enter the new value for the selected pack')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('new_pack_value')
                        .setPlaceholder('New value (number or null)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                );

            const modal = new ModalBuilder()
                .setCustomId('update_modal')
                .setTitle('Update Pack Sales')
                .addLabelComponents(selectLabel, inputLabel);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error executing update command:', error);
            await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
        }
    }
};
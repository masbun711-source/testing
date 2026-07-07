const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
  customId: 'reffund_pack',
  async execute(interaction) {
    try {
      if (!interaction.isButton?.()) return;

      const refundButtons = [1,2,3,4].map(i => new ButtonBuilder()
        .setCustomId(`refund_pack_${i}`)
        .setLabel(`Refund Pack ${i}`)
        .setStyle(ButtonStyle.Secondary)
      );

      const row = new ActionRowBuilder().addComponents(refundButtons);

      try {
        await interaction.update({ components: [row] });
      } catch (e) {
        try {
          const msg = interaction.message;
          if (msg && msg.edit) await msg.edit({ components: [row] });
          await interaction.reply({ content: 'Updated to refund options.', ephemeral: true });
        } catch (e2) {
          await interaction.reply({ content: 'Failed to show refund options.', ephemeral: true });
        }
      }
    } catch (err) {
      console.error('[reffund_pack] error:', err);
      try { await interaction.reply({ content: 'An error occurred.', ephemeral: true }); } catch {};
    }
  }
};
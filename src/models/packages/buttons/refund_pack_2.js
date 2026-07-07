const fs = require('fs').promises;
const path = require('path');

module.exports = {
  customId: 'refund_pack_2',
  async execute(interaction) {
    try {
      if (!interaction.isButton?.()) return;

      const dbPath = path.join(__dirname, '..', '..', '..', 'database', 'channel.json');
      let data = [];
      try {
        const raw = await fs.readFile(dbPath, 'utf8');
        data = JSON.parse(raw);
      } catch (e) {
        data = [];
      }

      const chanId = interaction.channelId || (interaction.channel && interaction.channel.id) || null;
      const userId = interaction.user?.id || null;
      const userName = interaction.user?.username || interaction.user?.tag || null;

      let row = (Array.isArray(data) && data.find(r => r.channel_id === String(chanId))) || null;
      if (!row) {
        row = {
          channel_id: String(chanId || ''),
          channel_name: interaction.channel?.name || null,
          user_id: userId,
          user_name: userName,
          pack_1: null,
          pack_2: null,
          pack_3: null,
          pack_4: null,
          reffund_pack_1: null,
          reffund_pack_2: null,
          reffund_pack_3: null,
          reffund_pack_4: null,
        };
        data.push(row);
      }

      const cur = row.reffund_pack_2;
      if (typeof cur === 'number') row.reffund_pack_2 = cur + 1;
      else row.reffund_pack_2 = 1;

      try {
        await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
      } catch (e) {
        console.error('[refund_pack_2] failed to write DB:', e);
      }

      const newContent = 'You have selected "refund pack 2"';
      try {
        if (typeof interaction.update === 'function') {
          await interaction.update({ content: newContent, components: [] });
        } else {
          const msg = interaction.message;
          if (msg && typeof msg.edit === 'function') await msg.edit({ content: newContent, components: [] });
          if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Refund recorded.', ephemeral: true });
        }
      } catch (e) {
        try { if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Refund recorded.', ephemeral: true }); } catch (e2) { /* ignore */ }
      }
    } catch (err) {
      console.error('[refund_pack_2] error:', err);
      try { await interaction.reply({ content: 'Error processing refund.', ephemeral: true }); } catch {};
    }
  }
};
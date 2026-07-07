const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const LB_FILE = path.join(__dirname, '..', '..', 'database', 'lb_monthly.json');

function _read() {
  try { if (!fs.existsSync(LB_FILE)) return []; return JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); } catch (e) { return []; }
}

async function postLeaderboard(client, targetChannelId) {
  try {
    const data = _read();
    if (!Array.isArray(data) || data.length === 0) return null;
    const sorted = data.slice().sort((a,b) => Number(b.clean || 0) - Number(a.clean || 0));
    const top = sorted.slice(0, 10);

    const embed = new EmbedBuilder()
      .setTitle('Leaderboard — Monthly')
      .setColor(0xFFD700)
      .setTimestamp();

    let desc = '';
    for (let i = 0; i < top.length; i++) {
      const row = top[i];
      desc += `**#${i+1}** <@${row.user_id}> — Clean: ${row.clean || 0} | Seed: ${row.seed || 0}\n`;
    }
    embed.setDescription(desc);

    const ch = await client.channels.fetch(targetChannelId).catch(() => null);
    if (!ch || typeof ch.send !== 'function') return null;
    return ch.send({ embeds: [embed] }).catch(() => null);
  } catch (e) { return null; }
}

module.exports = { postLeaderboard };

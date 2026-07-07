const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DB_DIR = path.join(__dirname, '..', '..', 'database');
const ALL_FILE = path.join(DB_DIR, 'lb_all.json');
const MONTH_FILE = path.join(DB_DIR, 'lb_monthly.json');

function _read(file) {
  try {
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function _write(file, arr) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(arr, null, 2), 'utf8');
  } catch (e) {
    /* ignore write errors */
  }
}

function ensureEntryIn(file, userId, channelId) {
  const db = _read(file);
  const found = db.find(r => String(r.user_id) === String(userId) && String(r.channel_id) === String(channelId));
  if (!found) {
    const entry = { user_id: String(userId), channel_id: String(channelId), clean: 0, seed: 0, rank: 0 };
    db.push(entry);
    _write(file, db);
    return entry;
  }
  return found;
}

function addCollectedTo(file, userId, channelId, cleanAmount = 0, seedAmount = 0) {
  const db = _read(file);
  let found = db.find(r => String(r.user_id) === String(userId) && String(r.channel_id) === String(channelId));
  if (!found) {
    found = { user_id: String(userId), channel_id: String(channelId), clean: 0, seed: 0, rank: 0 };
    db.push(found);
  }
  const c = Number(found.clean || 0) + Number(cleanAmount || 0);
  const s = Number(found.seed || 0) + Number(seedAmount || 0);
  found.clean = c;
  found.seed = s;
  _write(file, db);
  return found;
}

function removeByChannel(channelId) {
  const a = _read(ALL_FILE).filter(r => String(r.channel_id) !== String(channelId));
  const m = _read(MONTH_FILE).filter(r => String(r.channel_id) !== String(channelId));
  _write(ALL_FILE, a);
  _write(MONTH_FILE, m);
  return { all: a, monthly: m };
}

function listAll() { return _read(ALL_FILE); }
function listMonthly() { return _read(MONTH_FILE); }

function syncFromChannelDb() {
  try {
    const chFile = path.join(__dirname, '..', '..', 'database', 'channel.json');
    if (!fs.existsSync(chFile)) return;
    let channels = [];
    try { channels = JSON.parse(fs.readFileSync(chFile, 'utf8')); } catch (e) { channels = []; }
    for (const c of channels) {
      try { ensureEntryIn(ALL_FILE, c.user_id || c.user?.id || c.user, c.channel_id || c.channel?.id || c.channel); } catch (e) { /* ignore per-entry errors */ }
      try { ensureEntryIn(MONTH_FILE, c.user_id || c.user?.id || c.user, c.channel_id || c.channel?.id || c.channel); } catch (e) { /* ignore */ }
    }
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  ensureEntryAll: (u, c) => ensureEntryIn(ALL_FILE, u, c),
  ensureEntryMonthly: (u, c) => ensureEntryIn(MONTH_FILE, u, c),
  addCollectedAll: (u, c, clean, seed) => addCollectedTo(ALL_FILE, u, c, clean, seed),
  addCollectedMonthly: (u, c, clean, seed) => addCollectedTo(MONTH_FILE, u, c, clean, seed),
  removeByChannel,
  listAll,
  listMonthly,
  syncFromChannelDb
};

function _readConfigRaw() {
  try {
    const cfgPath = path.join(__dirname, '..', '..', '..', 'config.yaml');
    if (!fs.existsSync(cfgPath)) return null;
    return fs.readFileSync(cfgPath, 'utf8');
  } catch (e) {
    return null;
  }
}

function _parseLeaderboardChannelsFromConfig() {
  try {
    const raw = _readConfigRaw();
    if (!raw) return { all: null, monthly: null };

    const monthlyRe = /monthly\s*:\s*[\r\n\s]*channelId\s*:\s*(.+)/i;
    const allRe = /(?:^|\n)All\s*:\s*[\r\n\s]*channelId\s*:\s*(.+)/i;

    const mMatch = raw.match(monthlyRe);
    const aMatch = raw.match(allRe);

    const cleanVal = (v) => {
      if (!v) return null;
      const s = String(v).trim();
      if (s === 'null' || s === '' ) return null;
      return s.split('#')[0].trim();
    };

    return { all: cleanVal(aMatch && aMatch[1]), monthly: cleanVal(mMatch && mMatch[1]) };
  } catch (e) {
    return { all: null, monthly: null };
  }
}

function _buildEmbedFromList(title, rows) {
  const embed = new EmbedBuilder().setTitle(title).setColor(0x00AE86).setTimestamp();
  if (!rows || rows.length === 0) {
    embed.setDescription('No entries');
    return embed;
  }
  let desc = '';
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i];
    desc += `**#${i+1}** <@${r.user_id}> — Clean: ${r.clean || 0} | Seed: ${r.seed || 0}\n`;
  }
  embed.setDescription(desc);
  return embed;
}

async function updateOrPostAll(client) {
  try {
    const cfg = _parseLeaderboardChannelsFromConfig();
    const chId = cfg.all;
    if (!chId) return null;
    return await _postOrEdit(client, chId, _buildEmbedFromList('Leaderboard — All Time', listAll()));
  } catch (e) { return null; }
}

async function updateOrPostMonthly(client) {
  try {
    const cfg = _parseLeaderboardChannelsFromConfig();
    const chId = cfg.monthly;
    if (!chId) return null;
    return await _postOrEdit(client, chId, _buildEmbedFromList('Leaderboard — Monthly', listMonthly()));
  } catch (e) { return null; }
}

async function _postOrEdit(client, channelId, embed) {
  try {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || typeof ch.messages?.fetch !== 'function') return null;
    const fetched = await ch.messages.fetch({ limit: 10 }).catch(() => null);
    let candidate = null;
    if (fetched && fetched.size) {
      for (const [id, msg] of fetched) {
        if (msg.author && msg.author.id === client.user.id) {
          const hasEmbed = msg.embeds && msg.embeds.length > 0;
          const hasContent = msg.content && msg.content.trim() !== '';
          const hasComponents = msg.components && msg.components.length > 0;
          if (hasEmbed || hasContent || hasComponents) { candidate = msg; break; }
        }
      }
      if (!candidate) {
        for (const [id, msg] of fetched) {
          const hasEmbed = msg.embeds && msg.embeds.length > 0;
          const hasContent = msg.content && msg.content.trim() !== '';
          const hasComponents = msg.components && msg.components.length > 0;
          if (hasEmbed || hasContent || hasComponents) { candidate = msg; break; }
        }
      }
    }

    if (candidate) {
      try {
        return await candidate.edit({ embeds: [embed], content: '' });
      } catch (e) {
        return await ch.send({ embeds: [embed] }).catch(() => null);
      }
    
    }
    return await ch.send({ embeds: [embed] }).catch(() => null);
  } catch (e) { return null; }
}
  

module.exports.updateOrPostAll = updateOrPostAll;
module.exports.updateOrPostMonthly = updateOrPostMonthly;

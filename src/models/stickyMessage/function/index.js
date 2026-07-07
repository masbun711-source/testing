const fs = require('fs').promises;
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, PermissionsBitField } = require('discord.js');

const CHANNELS_DIR = path.join(__dirname, '..', 'channels');
const CATEGORY_DIR = path.join(__dirname, '..', 'category');
const _pendingDeletions = new Set();
const _lastSentAt = new Map();

async function loadChannelMessages(channelId) {
  const file = path.join(CHANNELS_DIR, channelId, 'message.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) throw new Error('message.json must be an array of message entries');
    return arr.map(normalizeEntry);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function normalizeEntry(entry = {}) {
  const payload = {};

  const type = (entry.type || 'message').toLowerCase();

  switch (type) {
    case 'component_v2':
    case 'component-v2':
    case 'component':
      if (entry.content) payload.content = entry.content;
      if (entry.components) payload.components = entry.components;
      if (entry.embeds) payload.embeds = entry.embeds;
      break;

    case 'embed':
    case 'embeds':
      if (entry.embed) payload.embeds = Array.isArray(entry.embed) ? entry.embed : [entry.embed];
      else if (entry.embeds) payload.embeds = entry.embeds;
      if (entry.content) payload.content = entry.content;
      break;

    case 'message':
    default:
      if (entry.content !== undefined) payload.content = typeof entry.content === 'string' ? entry.content : String(entry.content);
      if (entry.embeds) payload.embeds = entry.embeds;
      if (entry.components) payload.components = entry.components;
      break;
  }

  if (entry.allowedMentions) payload.allowedMentions = entry.allowedMentions;
  if (entry.ephemeral !== undefined) payload.ephemeral = !!entry.ephemeral;
  if (entry.username) payload.username = entry.username;
  if (entry.avatarURL) payload.avatarURL = entry.avatarURL;

  return payload;
}

module.exports = {
  loadChannelMessages,
  normalizeEntry,
};

function buildSendOptionsFromTemplate(tpl, options = {}) {
  const payload = normalizeEntry(tpl);
  const sendOptions = {};
  if (payload.content) sendOptions.content = payload.content;
  if (payload.allowedMentions) sendOptions.allowedMentions = payload.allowedMentions;
  if (payload.embeds) {
    try {
      const arr = Array.isArray(payload.embeds) ? payload.embeds : [payload.embeds];
      sendOptions.embeds = arr.map(e => new EmbedBuilder(e));
    } catch (e) {
      sendOptions.embeds = payload.embeds;
    }
  }
  if (payload.components) {
    try {
      sendOptions.components = (payload.components || []).map(row => {
        const comps = (row.components || []).map(c => new ButtonBuilder(c));
        return new ActionRowBuilder({ components: comps });
      });
    } catch (e) {
      sendOptions.components = payload.components;
    }
  }

  const footerText = options.footerText || process.env.STICKY_FOOTER || 'Powered by Bot AMANLVL';
  if (sendOptions.embeds && Array.isArray(sendOptions.embeds) && sendOptions.embeds.length) {
    for (const emb of sendOptions.embeds) {
      try {
        const existing = emb.data && emb.data.footer && emb.data.footer.text ? emb.data.footer.text : '';
        const newFooter = existing ? `${existing} ${footerText}` : `${footerText}`;
        emb.setFooter({ text: newFooter });
      } catch (e) {
        /* ignore */
      }
    }
  } else {
    const markerContent = `-# ${footerText}`;
    if (sendOptions.content) sendOptions.content = `${sendOptions.content}\n${markerContent}`;
    else sendOptions.content = markerContent;
  }

  return sendOptions;
}

const LAST_SENT_FILE = (channelId) => path.join(CHANNELS_DIR, channelId, 'last_sent.json');

async function _readLastSent(channelId) {
  try {
    const raw = await fs.readFile(LAST_SENT_FILE(channelId), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

async function _writeLastSent(channelId, ids) {
  try {
    await fs.mkdir(path.join(CHANNELS_DIR, channelId), { recursive: true });
    await fs.writeFile(LAST_SENT_FILE(channelId), JSON.stringify(ids, null, 2), 'utf8');
  } catch (e) {
    /* ignore write errors */
  }
}

async function sendChannelMessages(client, channelId, options = {}) {
  const channel = client.channels?.cache.get(channelId) || (client.channels?.fetch ? await client.channels.fetch(channelId).catch(() => null) : null);
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  try {
    const parentId = channel.parentId || (channel.parent && channel.parent.id) || null;
    if (parentId) {
      const catFile = path.join(CATEGORY_DIR, parentId, 'messages.json');
      try {
        const stat = await fs.stat(catFile).catch(() => null);
        if (stat) {
          console.log(`⤴️ Channel ${channelId} is managed by category ${parentId}; skipping channel watcher`);
          return null;
        }
      } catch (e) {
        /* ignore */
      }
    }
  } catch (e) {
    /* ignore parent check errors */
  }

  if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) {
    console.warn(`sticky: channel ${channelId} is not text-based; skipping`);
    return [];
  }

  const perms = channel.permissionsFor ? channel.permissionsFor(client.user) : null;
  if (perms && !perms.has(PermissionsBitField.Flags.SendMessages)) {
    console.warn(`sticky: missing SendMessages permission in ${channelId}; skipping`);
    return [];
  }
  if (perms && !perms.has(PermissionsBitField.Flags.EmbedLinks)) {
    console.warn(`sticky: missing EmbedLinks permission in ${channelId}; embeds will be stripped`);
  }
  if (options.replacePrevious && perms && !perms.has(PermissionsBitField.Flags.ManageMessages)) {
    console.warn(`sticky: missing ManageMessages in ${channelId}; disabling replacePrevious`);
    options.replacePrevious = false;
  }

  const entries = await loadChannelMessages(channelId);
  const sent = [];

  if (options.replacePrevious) {
    const prev = await _readLastSent(channelId);
    if (Array.isArray(prev) && prev.length > 0) {
      for (const id of prev) {
        try {
          const msg = await channel.messages.fetch(id).catch(() => null);
          if (msg && !msg.pinned) {
            _pendingDeletions.add(msg.id);
            await msg.delete().catch(() => null);
          }
        } catch (e) {
          /* ignore */
        }
      }
    } else {
      try {
        const fetched = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        if (fetched && fetched.size) {
          for (const [id, msg] of fetched) {
            try {
              const footerText = options.footerText || process.env.STICKY_FOOTER || 'Powered by Bot AMANLVL';
              const contentMarker = `-# ${footerText}`;
              const hasMarker = (msg.embeds && msg.embeds.some(e => e.footer && e.footer.text && e.footer.text.includes(footerText))) || (msg.content && msg.content.includes(contentMarker));
              const isOurMsg = (msg.author && msg.author.id === client.user.id) || (msg.webhookId && options.webhookClient);
              if (isOurMsg && !msg.pinned && hasMarker) {
                _pendingDeletions.add(msg.id);
                await msg.delete().catch(() => null);
              }
            } catch (e) {
              /* ignore */
            }
          }
        }
      } catch (e) {
        /* ignore fallback deletion errors */
      }
    }
  }

  for (const payload of entries) {
    if (!payload || Object.keys(payload).length === 0) continue;

    const sendOptions = {};
    if (payload.content) sendOptions.content = payload.content;
    if (payload.allowedMentions) sendOptions.allowedMentions = payload.allowedMentions;

    if (payload.embeds && perms && perms.has(PermissionsBitField.Flags.EmbedLinks)) {
      try {
        const arr = Array.isArray(payload.embeds) ? payload.embeds : [payload.embeds];
        sendOptions.embeds = arr.map(e => new EmbedBuilder(e));
      } catch (e) {
        console.warn(`sticky: failed to convert embeds for ${channelId}, sending raw embeds`);
        sendOptions.embeds = payload.embeds;
      }
    } else if (payload.embeds) {
      delete payload.embeds;
    }

    if (payload.components) {
      try {
        sendOptions.components = (payload.components || []).map(row => {
          const comps = (row.components || []).map(c => new ButtonBuilder(c));
          return new ActionRowBuilder({ components: comps });
        });
      } catch (e) {
        console.warn(`sticky: failed to convert components for ${channelId}, sending raw components`);
        sendOptions.components = payload.components;
      }
    }

    let message = null;

    if (options.webhookClient) {
      const webhookPayload = Object.assign({}, sendOptions);
      if (payload.username) webhookPayload.username = payload.username;
      if (payload.avatarURL) webhookPayload.avatarURL = payload.avatarURL;
      try {
        message = await options.webhookClient.send(webhookPayload);
      } catch (e) {
        console.warn(`sticky: webhook send failed for ${channelId}, will try channel.send`, e.message || e);
      }
    }

    if (!message) {
      try {
        message = await channel.send(sendOptions);
      } catch (e1) {
        console.warn(`sticky: first send failed for ${channelId}, retrying once`, e1.message || e1);
        try {
          await new Promise(res => setTimeout(res, 500));
          message = await channel.send(sendOptions);
        } catch (e2) {
          console.error(`sticky: send failed twice for ${channelId}`, e2.message || e2);
          message = null;
        }
      }
    }

    if (message) sent.push(message);
  }

  if (options.saveLast !== false) {
    const ids = sent.map(m => (m.id ? m.id : null)).filter(Boolean);
    await _writeLastSent(channelId, ids);
  }

  return sent;
}

function scheduleStickyMessages(client, channelId, intervalMs, options = {}) {
  if (!intervalMs || typeof intervalMs !== 'number' || intervalMs <= 0) throw new Error('intervalMs must be a positive number');

  sendChannelMessages(client, channelId, options).catch(() => null);

  const id = setInterval(() => {
    sendChannelMessages(client, channelId, options).catch(() => null);
  }, intervalMs);

  return id;
}

module.exports.sendChannelMessages = sendChannelMessages;
module.exports.scheduleStickyMessages = scheduleStickyMessages;

async function _readRawFile(channelId) {
  const file = path.join(CHANNELS_DIR, channelId, 'message.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return { file, data: JSON.parse(raw) };
  } catch (e) {
    return { file, data: null };
  }
}

async function _writeRawFile(file, data) {
  try {
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    /* ignore */
  }
}

async function watchChannelSticky(client, channelId, options = {}) {
  const { file, data } = await _readRawFile(channelId);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const template = data[0];

  const channel = client.channels?.cache.get(channelId) || (client.channels?.fetch ? await client.channels.fetch(channelId).catch(() => null) : null);
  if (!channel) throw new Error(`Channel ${channelId} not found`);



  let lastId = template.last_message && template.last_message.message ? template.last_message.message : null;
  if (lastId) {
    try {
      const existing = await channel.messages.fetch(lastId).catch(() => null);
      if (!existing) {
        const sendOptions = buildSendOptionsFromTemplate(template, options);
        const sent = await channel.send(sendOptions).catch(() => null);
        if (sent && sent.id) {
          template.last_message = { message: sent.id };
          await _writeRawFile(file, data);
          try { _lastSentAt.set(`chan:${channelId}`, Date.now()); } catch(e) { /* ignore */ }
          lastId = sent.id;
        }
      }
    } catch (e) {
      /* ignore */
    }
  } else {
    const sendOptions = buildSendOptionsFromTemplate(template, options);
    try {
      const sent = await channel.send(sendOptions).catch(() => null);
      if (sent && sent.id) {
        template.last_message = { message: sent.id };
        await _writeRawFile(file, data);
        try { _lastSentAt.set(`chan:${channelId}`, Date.now()); } catch(e) { /* ignore */ }
        lastId = sent.id;
      }
    } catch (e) {
      /* ignore */
    }
  }

  const handleTrigger = async (source) => {
    try {
      const chId = source.channelId || (source.channel && source.channel.id) || null;
      const userIsBot = source.author?.bot || source.user?.bot;
      if (!chId || chId !== channelId) return;
      if (userIsBot) return;

      if (template.last_message && template.last_message.message) {
        try {
          const prev = await channel.messages.fetch(template.last_message.message).catch(() => null);
          const isPrevOwned = (prev && prev.author && prev.author.id === client.user.id) || (prev && prev.webhookId && options.webhookClient);
          if (prev && !prev.pinned && isPrevOwned) {
            const footerText = options.footerText || process.env.STICKY_FOOTER || 'Powered by Bot AMANLVL';
            const contentMarker = `-# ${footerText}`;
            const hasMarker = (prev.embeds && prev.embeds.some(e => e.footer && e.footer.text && e.footer.text.includes(footerText))) || (prev.content && prev.content.includes(contentMarker));
            if (hasMarker) {
              _pendingDeletions.add(prev.id);
              await prev.delete().catch(() => null);
            }
          }
        } catch (e) {
          /* ignore */
        }
      }

      const key = `chan:${channelId}`;
      const last = _lastSentAt.get(key) || 0;
      if (Date.now() - last < (options.minDuplicateDelay || 1200)) return;

      const sendOptions = buildSendOptionsFromTemplate(template, options);
      const sent = await channel.send(sendOptions).catch(() => null);
      if (sent && sent.id) {
        template.last_message = { message: sent.id };
        await _writeRawFile(file, data);
        try { _lastSentAt.set(key, Date.now()); } catch(e) { /* ignore */ }
      }
    } catch (e) {
      /* ignore */
    }
  };

  const msgHandler = (m) => handleTrigger(m);
  const intHandler = (i) => {
    try {
      if (!i) return;
      if (typeof i.isChatInputCommand === 'function' && i.isChatInputCommand()) return;
      if (typeof i.isAutocomplete === 'function' && i.isAutocomplete()) return;
      if (typeof i.isButton === 'function' && i.isButton()) return handleTrigger(i);
      if (typeof i.isSelectMenu === 'function' && i.isSelectMenu()) return handleTrigger(i);
      if (typeof i.isModalSubmit === 'function' && i.isModalSubmit()) return handleTrigger(i);
    } catch (e) {
      /* ignore */
    }
  };

  client.on('messageCreate', msgHandler);
  client.on('interactionCreate', intHandler);

  const deleteHandler = async (msg) => {
    try {
      if (!msg) return;
      if (_pendingDeletions.has(msg.id)) { _pendingDeletions.delete(msg.id); return; }
      if (template.last_message && template.last_message.message && msg.id === template.last_message.message) {
        const key = `chan:${channelId}`;
        const last = _lastSentAt.get(key) || 0;
        if (Date.now() - last < (options.minDuplicateDelay || 1200)) return;

        const sendOptions = buildSendOptionsFromTemplate(template, options);
        const sent = await channel.send(sendOptions).catch(() => null);
        if (sent && sent.id) {
          template.last_message = { message: sent.id };
          await _writeRawFile(file, data);
          try { _lastSentAt.set(key, Date.now()); } catch(e) { /* ignore */ }
        }
      }
    } catch (e) {
      /* ignore */
    }
  };

  client.on('messageDelete', deleteHandler);

  return { stop: () => { client.off('messageCreate', msgHandler); client.off('interactionCreate', intHandler); client.off('messageDelete', deleteHandler); } };
}

module.exports.watchChannelSticky = watchChannelSticky;

async function _readCategoryRawFile(categoryId) {
  const file = path.join(CATEGORY_DIR, categoryId, 'messages.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return { file, data: JSON.parse(raw) };
  } catch (e) {
    return { file, data: null };
  }
}

async function watchCategorySticky(client, categoryId, options = {}) {
  const { file, data } = await _readCategoryRawFile(categoryId);
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const template = data[0];

  const category = client.channels?.cache.get(categoryId) || (client.channels?.fetch ? await client.channels.fetch(categoryId).catch(() => null) : null);
  if (!category) throw new Error(`Category ${categoryId} not found`);

  function buildSendOptionsFromTemplateLocal(tpl) {
    return buildSendOptionsFromTemplate(tpl, options);
  }

  function getChildTextChannels() {
    return client.channels.cache.filter(c => c.parentId === categoryId && typeof c.isTextBased === 'function' && c.isTextBased());
  }

  if (!template.last_message || typeof template.last_message !== 'object' || Array.isArray(template.last_message)) template.last_message = {};

  const children = getChildTextChannels();
  for (const [chId, ch] of children) {
    const lastId = template.last_message[chId] || null;
    if (lastId) {
      try {
        const existing = await ch.messages.fetch(lastId).catch(() => null);
        if (!existing) {
          const sendOptions = buildSendOptionsFromTemplateLocal(template);
          const sent = await ch.send(sendOptions).catch(() => null);
          if (sent && sent.id) {
            template.last_message[chId] = sent.id;
            await _writeRawFile(file, data);
          }
        }
      } catch (e) {
        /* ignore */
      }
    } else {
      const sendOptions = buildSendOptionsFromTemplateLocal(template);
      try {
        const sent = await ch.send(sendOptions).catch(() => null);
        if (sent && sent.id) {
          template.last_message[chId] = sent.id;
          await _writeRawFile(file, data);
          try { _lastSentAt.set(`cat:${categoryId}:${chId}`, Date.now()); } catch(e) { /* ignore */ }
            try { _lastSentAt.set(`cat:${categoryId}:${chId}`, Date.now()); } catch(e) { /* ignore */ }
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  const handleTrigger = async (source) => {
    try {
      const chId = source.channelId || (source.channel && source.channel.id) || null;
      const userIsBot = source.author?.bot || source.user?.bot;
      if (!chId) return;
      const channelObj = client.channels.cache.get(chId) || (client.channels.fetch ? await client.channels.fetch(chId).catch(() => null) : null);
      if (!channelObj || channelObj.parentId !== categoryId) return;
      if (userIsBot) return;

      if (template.last_message && template.last_message[chId]) {
        try {
          const prev = await channelObj.messages.fetch(template.last_message[chId]).catch(() => null);
          const isPrevOwned = (prev && prev.author && prev.author.id === client.user.id) || (prev && prev.webhookId && options.webhookClient);
          if (prev && !prev.pinned && isPrevOwned) {
            const footerText = options.footerText || process.env.STICKY_FOOTER || 'Powered by Bot AMANLVL';
            const contentMarker = `-# ${footerText}`;
            const hasMarker = (prev.embeds && prev.embeds.some(e => e.footer && e.footer.text && e.footer.text.includes(footerText))) || (prev.content && prev.content.includes(contentMarker));
            if (hasMarker) {
              _pendingDeletions.add(prev.id);
              await prev.delete().catch(() => null);
            }
          }
        } catch (e) { /* ignore */ }
      }

      const key = `cat:${categoryId}:${chId}`;
      const last = _lastSentAt.get(key) || 0;
      if (Date.now() - last < (options.minDuplicateDelay || 1200)) return;

      const sendOptions = buildSendOptionsFromTemplateLocal(template);
      const sent = await channelObj.send(sendOptions).catch(() => null);
      if (sent && sent.id) {
        template.last_message[chId] = sent.id;
        await _writeRawFile(file, data);
        try { _lastSentAt.set(key, Date.now()); } catch(e) { /* ignore */ }
      }
    } catch (e) {
      /* ignore */
    }
  };

  const msgHandler = (m) => handleTrigger(m);
  const intHandler = (i) => {
    try {
      if (!i) return;
      if (typeof i.isChatInputCommand === 'function' && i.isChatInputCommand()) return;
      if (typeof i.isAutocomplete === 'function' && i.isAutocomplete()) return;
      if (typeof i.isButton === 'function' && i.isButton()) return handleTrigger(i);
      if (typeof i.isSelectMenu === 'function' && i.isSelectMenu()) return handleTrigger(i);
      if (typeof i.isModalSubmit === 'function' && i.isModalSubmit()) return handleTrigger(i);
    } catch (e) {
      /* ignore */
    }
  };

  client.on('messageCreate', msgHandler);
  client.on('interactionCreate', intHandler);

  const deleteHandler = async (msg) => {
    try {
      if (!msg) return;
      if (_pendingDeletions.has(msg.id)) { _pendingDeletions.delete(msg.id); return; }
      const chId = msg.channelId || (msg.channel && msg.channel.id);
      if (template.last_message && chId && template.last_message[chId] && msg.id === template.last_message[chId]) {
        const channelObj = client.channels.cache.get(chId) || (client.channels.fetch ? await client.channels.fetch(chId).catch(() => null) : null);
        if (!channelObj) return;
        const key = `cat:${categoryId}:${chId}`;
        const last = _lastSentAt.get(key) || 0;
        if (Date.now() - last < (options.minDuplicateDelay || 1200)) return;

        const sendOptions = buildSendOptionsFromTemplateLocal(template);
        const sent = await channelObj.send(sendOptions).catch(() => null);
        if (sent && sent.id) {
          template.last_message[chId] = sent.id;
          await _writeRawFile(file, data);
          try { _lastSentAt.set(key, Date.now()); } catch(e) { /* ignore */ }
        }
      }
    } catch (e) {
      /* ignore */
    }
  };

  client.on('messageDelete', deleteHandler);

  return { stop: () => { client.off('messageCreate', msgHandler); client.off('messageDelete', deleteHandler); client.off('interactionCreate', intHandler); } };
}

module.exports.watchCategorySticky = watchCategorySticky;

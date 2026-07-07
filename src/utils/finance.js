const path = require('path');

const EMOJI_WL = '<:WL:1453429476515123302>';
const EMOJI_DL = '<a:shinyDL:1453429374731685908>';
const EMOJI_BGL = '<:shinyBGL:1453429362807279687>';

function toNumberSafe(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(n) {
  try {
    return new Intl.NumberFormat('en-US').format(toNumberSafe(n));
  } catch (e) {
    return String(n);
  }
}

/**
 * Format a price with currency breakdown emoji when applicable.
 * Returns a string like "1<BGL> 2<DL> 50<WL> (10250)" or a plain formatted number.
 */
function formatPriceWithEmoji(value) {
  if (value === null || value === undefined) return 'N/A';
  const n = toNumberSafe(value);
  const broken = breakdownPriceWithEmoji(n);
  if (broken && broken.length > 0) return `${broken} (${formatNumber(n)})`;
  return formatNumber(n);
}

/**
 * Calculate profit and vending totals for a channel entry.
 * @param {Object} channelEntry  The channel object from channel.json
 * @param {Array} packs The packs array from packs.json
 * @param {Array} packKeys Optional array of pack keys (['pack_1',...])
 * @returns {Object} { profitLines, profitTotal, vendingLines, vendingTotal, cleanvend }
 */
function calculateCleanVending(channelEntry, packs, packKeys = ['pack_1', 'pack_2', 'pack_3', 'pack_4']) {
  const profitLines = [];
  const vendingLines = [];
  let profitTotal = 0;
  let vendingTotal = 0; // net vending (sold - refunded)
  let soldTotal = 0; // total sold = price * count
  let refundTotal = 0; // total refunded = price * refundCount
  let seedTotal = 0; // total seed

  for (let i = 0; i < packKeys.length; i++) {
    const k = packKeys[i];
    const count = toNumberSafe(channelEntry && channelEntry[k]);
    const refundKey = `reffund_${k}`;
    const refundCount = toNumberSafe(channelEntry && channelEntry[refundKey]);

    const packEntry = packs.find(p => p && Object.prototype.hasOwnProperty.call(p, k)) || null;
    const packSpec = packEntry ? packEntry[k] : null;
    const profitPerUnit = packEntry && Object.prototype.hasOwnProperty.call(packEntry, 'profit') ? (packEntry.profit == null ? null : toNumberSafe(packEntry.profit)) : null;
    const pricePerUnit = packSpec && Object.prototype.hasOwnProperty.call(packSpec, 'price') ? (packSpec.price == null ? null : toNumberSafe(packSpec.price)) : null;

    if (profitPerUnit === null) {
      profitLines.push(`${(packSpec && packSpec.name) || `Pack ${i + 1}`} profit: N/A`);
    } else {
      const subtotal = profitPerUnit * count;
      profitLines.push(`${(packSpec && packSpec.name) || `Pack ${i + 1}`} profit: ${profitPerUnit} x ${count} = ${subtotal}`);
      profitTotal += subtotal;
    }

    if (pricePerUnit === null) {
      vendingLines.push(`${(packSpec && packSpec.name) || `Pack ${i + 1}`} vending: N/A`);
    } else {
      const sold = pricePerUnit * count;
      const refunded = pricePerUnit * refundCount;
      const net = sold - refunded;
      vendingLines.push(`${formatNumber(net)}`);
      vendingTotal += net;
      soldTotal += sold;
      refundTotal += refunded;
    }

    const packTop = packs.find(p => p && Object.prototype.hasOwnProperty.call(p, k)) || null;
    if (packTop) {
      seedTotal += toNumberSafe(packTop.seed) * count;
    }
  }

  const clean = profitTotal + soldTotal;

  return {
    profitLines,
    profitTotal,
    vendingLines,
    vendingTotal,
    soldTotal,
    refundTotal,
    seedTotal,
    clean,
  };
}

module.exports = { calculateCleanVending, formatPriceWithEmoji, formatNumber, EMOJI_WL, EMOJI_DL, EMOJI_BGL };

/**
 * Break down a price (assumed in WL units) into BGL/DL/WL using:
 * 100 WL = 1 DL, 100 DL = 1 BGL
 * Returns formatted string with emojis, e.g. "5<:shinyBGL...> 25<a:shinyDL...> 10<:WL...>"
 */
function breakdownPriceWithEmoji(totalWl) {
  const total = toNumberSafe(totalWl);
  const perDl = 100;
  const perBgl = perDl * 100; // 10000

  const bgl = Math.floor(total / perBgl);
  let rem = total % perBgl;
  const dl = Math.floor(rem / perDl);
  const wl = rem % perDl;

  const parts = [];
  if (bgl > 0) parts.push(`${bgl}${EMOJI_BGL}`);
  if (dl > 0) parts.push(`${dl}${EMOJI_DL}`);
  if (wl > 0) parts.push(`${wl}${EMOJI_WL}`);
  return parts.join(' ');
}

module.exports = Object.assign(module.exports, { breakdownPriceWithEmoji });

/**
 * emoji for seed and jar
 * @return {string} emoji
 * @param {string} type 'seed' or 'jar'
 * @param {number} value number to format
 * @return {string} formatted string with emoji
 */

function emojiForSeedJar(type) {
  if (type === 'seed') return '<:Seed:1453966844921643128>';
  if (type === 'jar') return '<:Jar:1453966777884086272>';
  return '';
}
function formatSeedJarWithEmoji(value, type) {
  if (value === null || value === undefined) return 'N/A';
  return `${formatNumber(value)} ${emojiForSeedJar(type)}`;
}

module.exports = Object.assign(module.exports, { emojiForSeedJar, formatSeedJarWithEmoji });
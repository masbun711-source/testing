const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const { breakdownPriceWithEmoji } = require('../../utils/finance');

const configPath = path.join(__dirname, '../../database/packs.json');
const packsPath = path.join(__dirname, '../../database/packs.json');

async function loadCalculatorConfig() {
    try {
        const data = await fs.readFile(configPath, 'utf8');
        const configs = JSON.parse(data);
        return Array.isArray(configs) ? configs : [configs];
    } catch (error) {
        console.error('Error reading calculator config:', error);
        return [];
    }
}

function formatTime(minutes) {
    if (minutes < 60) {
        return `${minutes} menit`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
            return `${hours} jam`;
        } else {
            return `${hours} jam ${remainingMinutes} menit`;
        }
    }
}

function formatCleanValue(value) {
    try {
        if (typeof value !== 'number') value = Number(value) || 0;
        return new Intl.NumberFormat('en-US').format(value);
    } catch (e) {
        return String(value);
    }
}

function buildCumulative(maxLevel = 125, baseLevel = 1) {
    const cumulative = [];
    cumulative[1] = 0;
    let cum = 0;
    for (let level = 2; level <= maxLevel; level++) {
        const expForLevel = 50 * Math.pow(baseLevel + (level - 2), 2) + 100;
        cum += expForLevel;
        cumulative[level] = cum;
    }
    return cumulative;
}

const CUMULATIVE_XP = buildCumulative(125, 1);

function calculateXpMessage(startLevel, targetLevel) {
    startLevel = Number(startLevel) || 1;
    targetLevel = Number(targetLevel) || startLevel;
    if (targetLevel <= startLevel) return 0;
    const s = Math.max(1, Math.min(125, Math.floor(startLevel)));
    const t = Math.max(1, Math.min(125, Math.floor(targetLevel)));
    return (CUMULATIVE_XP[t] || 0) - (CUMULATIVE_XP[s] || 0);
}

function calculateXpBetween(startLevel, startXp, endLevel, endXp) {
    startLevel = Number(startLevel) || 1;
    endLevel = Number(endLevel) || startLevel;
    startXp = Number(startXp) || 0;
    endXp = Number(endXp) || 0;

    const s = Math.max(1, Math.min(125, Math.floor(startLevel)));
    const e = Math.max(1, Math.min(125, Math.floor(endLevel)));

    const totalStart = (CUMULATIVE_XP[s] || 0) + startXp;
    const totalEnd = (CUMULATIVE_XP[e] || 0) + endXp;

    return Math.max(0, totalEnd - totalStart);
}

async function recommendationPack(xpRequired) {
    const packsPath = path.join(__dirname, '../../database/packs.json');
    let packsData;
    try {
        const data = await fs.readFile(packsPath, 'utf8');
        packsData = JSON.parse(data);
    } catch (err) {
        console.error('Error reading packs.json:', err);
        return [];
    }

    const priceList = {};
    for (const packObj of packsData) {
        for (const key of Object.keys(packObj)) {
            if (key.startsWith('pack_')) {
                priceList[key] = packObj[key];
            }
        }
    }

    const recommendations = [];

    for (const [packKey, pack] of Object.entries(priceList)) {
        if (!pack.xp || !pack.price || !pack.duration) continue;
        const packsNeeded = Math.ceil(xpRequired / pack.xp);
        if (packsNeeded > 0) {
            const unitPrice = Number(pack.price) || 0;
            const totalPrice = packsNeeded * unitPrice;
            recommendations.push({
                type: packKey,
                packs: packsNeeded,
                totalXp: packsNeeded * pack.xp,
                totalPrice: totalPrice,
                unitPrice: unitPrice,
                totalTime: packsNeeded * pack.duration,
                excessXp: (packsNeeded * pack.xp) - xpRequired,
                name: pack.name,
                emoji: pack.emoji
            });
        }
    }

    recommendations.sort((a, b) => a.totalPrice - b.totalPrice);
    return recommendations.slice(0, 3);
}

/**
 * Calculate clean profit, seed total and jar total from provided pack counts.
 * @param {{pack_1?: number, pack_2?: number, pack_3?: number, pack_4?: number}} counts
 * @returns {Promise<{ clean: number, cleanProfitPack: number, seedTotal: number, jarTotal: number }>} 
 */
async function calculateCleanFromPacks(counts) {
    let packsData;
    try {
        const raw = await fs.readFile(packsPath, 'utf8');
        packsData = JSON.parse(raw);
    } catch (err) {
        console.error('Error reading packs.json in calculateCleanFromPacks:', err);
        return { clean: 0, cleanProfitPack: 0, seedTotal: 0, jarTotal: 0 };
    }

    const packIndex = {};
    for (const packObj of packsData) {
        for (const key of Object.keys(packObj)) {
            if (key.startsWith('pack_')) {
                const def = packObj[key] || {};
                packIndex[key] = {
                    profit: Number(packObj.profit) || 0,
                    seed: Number(packObj.seed) || 0,
                    jar: Number(packObj.jar) || 0,
                    name: def.name || '',
                    emoji: def.emoji || ''
                };
            }
        }
    }

    let cleanProfitPack = 0;
    let seedTotal = 0;
    let jarTotal = 0;

    for (const packKey of ['pack_1', 'pack_2', 'pack_3', 'pack_4']) {
        const amount = Number(counts[packKey] || 0);
        if (!amount) continue;

        const pack = packIndex[packKey];
        if (!pack) continue;

        cleanProfitPack += amount * pack.profit;
        seedTotal += amount * pack.seed;
        jarTotal += amount * pack.jar;
    }

    const clean = cleanProfitPack + seedTotal + jarTotal;

    return { clean, cleanProfitPack, seedTotal, jarTotal };
}

function createCalculatorEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('🧮 Level Calculator')
        .setDescription('Calculate the price for leveling up from one level to another.\n\nClick the button below to open the calculator!')
        .setColor(0x0099FF)
        .addFields(
            {
                name: 'How it works:',
                value: '1. Click "Calculate Level Price"\n2. Enter your start level\n3. Enter your target level\n4. Get instant price calculation',
                inline: false
            },
            {
                name: 'Note:',
                value: 'Prices are estimated based on XP requirements and current market rates.',
                inline: false
            }
        )
        .setTimestamp();

    return embed;
}

function createCalculatorButton() {
    const calculatorButton = new ButtonBuilder()
        .setCustomId('open_calculator')
        .setLabel('Calculate Level Price')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🧮');

    const row = new ActionRowBuilder().addComponents(calculatorButton);
    return row;
}

function createCalculatorModal() {
    const modal = new ModalBuilder()
        .setCustomId('calculator_modal')
        .setTitle('Level Calculator');

    const startLevelInput = new TextInputBuilder()
        .setCustomId('start_level')
        .setLabel('Start Level')
        .setPlaceholder('Enter your current level (1-124)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

    const targetLevelInput = new TextInputBuilder()
        .setCustomId('target_level')
        .setLabel('Target Level')
        .setPlaceholder('Enter your target level (2-125)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

    const modalFirstRow = new ActionRowBuilder().addComponents(startLevelInput);
    const modalSecondRow = new ActionRowBuilder().addComponents(targetLevelInput);

    modal.addComponents(modalFirstRow, modalSecondRow);
    return modal;
}

async function handleCalculatorButton(interaction) {
    try {
        const modal = createCalculatorModal();
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error handling calculator button:', error);
        await interaction.reply({
            content: 'There was an error opening the calculator.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleCalculatorModal(interaction) {
    try {
        if (interaction.customId === 'calculator_modal') {
            const startLevel = parseInt(interaction.fields.getTextInputValue('start_level'));
            const targetLevel = parseInt(interaction.fields.getTextInputValue('target_level'));

            if (isNaN(startLevel) || isNaN(targetLevel)) {
                return await interaction.reply({
                    content: 'Please enter valid numbers for both levels.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (startLevel <= 0 || targetLevel <= 0) {
                return await interaction.reply({
                    content: 'Levels must be positive numbers.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (startLevel >= targetLevel) {
                return await interaction.reply({
                    content: 'Target level must be greater than start level.',
                    flags: MessageFlags.Ephemeral
                });
            }

            if (targetLevel > 125) {
                return await interaction.reply({
                    content: 'Target level cannot exceed 125.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const xpRequired = calculateXpMessage(startLevel, targetLevel);
            const recommendations = await recommendationPack(xpRequired);
            const embed = createCalculatorResultEmbed(startLevel, targetLevel, xpRequired, recommendations);

            await interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('Error handling calculator modal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error calculating the levels.',
                flags: MessageFlags.Ephemeral
            });
        } else {
            try {
                await interaction.followUp({
                    content: 'There was an error calculating the levels.',
                    flags: MessageFlags.Ephemeral
                });
            } catch (followUpError) {
                console.error('Failed to send follow-up error message:', followUpError);
            }
        }
    }
}

const startAutoSend = async (client) => {
    try {
        const configs = await loadCalculatorConfig();

        for (const config of configs) {
            if (!config.guild_id || !config.channel_id) {
                console.log(`Skipping calculator config with missing guild_id or channel_id: ${JSON.stringify(config)}`);
                continue;
            }

            try {
                const channel = await client.channels.fetch(config.channel_id);
                if (!channel) {
                    console.log(`Calculator channel not found for guild ${config.guild_id}. Skipping auto-send.`);
                    continue;
                }
                if (!channel.isTextBased || typeof channel.send !== 'function') {
                    console.log(`Channel ${config.channel_id} in guild ${config.guild_id} is not a text-based channel. Skipping auto-send.`);
                    continue;
                }

                const messages = await channel.messages.fetch({ limit: 10 });
                const calculatorMessage = messages.find(msg =>
                    msg.author.id === client.user.id &&
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title?.includes('Calculator')
                );
                setupAutoDeleteForChannel(client, config.channel_id);

            } catch (channelErr) {
                console.error(`Error processing calculator for guild ${config.guild_id}:`, channelErr);
            }
        }

    } catch (error) {
        console.error('Error in calculator auto-send:', error);
    }
};

async function setupAutoDeleteForChannel(client, channelId) {
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) {
            return;
        }

        setInterval(async () => {
            try {
                const messages = await channel.messages.fetch({ limit: 50 });
                const calculatorMessage = messages.find(msg =>
                    msg.author.id === client.user.id &&
                    msg.embeds.length > 0 &&
                    msg.embeds[0].title?.includes('Calculator')
                );

                for (const [id, message] of messages) {
                    if (message.id !== calculatorMessage?.id && message.author.id !== client.user.id) {
                        await message.delete().catch(console.error);
                    }
                }
            } catch (error) {
                console.error('Error in auto-delete for channel:', channelId, error);
            }
        }, 60000);

        console.log(`Auto-delete system activated for calculator channel: ${channelId}`);
    } catch (error) {
        console.error('Error setting up auto-delete for channel:', channelId, error);
    }
}

module.exports = {
    handleCalculatorButton,
    handleCalculatorModal,
    startAutoSend,
    createCalculatorEmbed,
    createCalculatorButton,
    recommendationPack,
    // ...existing code...
    formatCleanValue,
    calculateXpMessage,
    calculateXpBetween,
    calculateCleanFromPacks,
};
